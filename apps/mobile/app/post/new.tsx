import React, { useState } from 'react';
import {
  View, Text, TextInput, StyleSheet, ScrollView, Alert, Pressable, Image, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { supabase } from '../../src/lib/supabase';
import { useAuth } from '../../src/lib/auth';
import { useI18n } from '../../src/lib/i18n';
import { palette, radius } from '../../src/lib/theme';
import { Btn, ChipRow, Chip, Label, ErrorState } from '../../src/components/ui';
import { uploadWithProgress } from '../../src/lib/upload';

type Attachment = {
  id: string;
  uri: string;
  kind: 'image' | 'video' | 'file';
  mime: string;
  name: string;
  progress: number;
  url?: string;
  path?: string;
  error?: string;
};

export default function NewPost() {
  const me = useAuth((s) => s.me);
  const { t } = useI18n();
  const router = useRouter();
  const qc = useQueryClient();

  const [body, setBody] = useState('');
  const [visibility, setVisibility] = useState<'public' | 'friends' | 'private'>('public');
  const [files, setFiles] = useState<Attachment[]>([]);
  const [busy, setBusy] = useState(false);

  if (!me) {
    return (
      <View style={s.wrap}>
        <ErrorState text={t('sign_in')} onRetry={() => router.push('/(auth)/sign-in')} retryLabel={t('sign_in')} />
      </View>
    );
  }

  async function pickImages() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return Alert.alert(t('error'), 'Photo library permission is required.');
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsMultipleSelection: true,
      quality: 0.85,
      videoMaxDuration: 90,
    });
    if (res.canceled) return;
    const next: Attachment[] = res.assets.map((a) => ({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      uri: a.uri,
      kind: a.type === 'video' ? 'video' : 'image',
      mime: a.mimeType ?? (a.type === 'video' ? 'video/mp4' : 'image/jpeg'),
      name: a.fileName ?? `media-${Date.now()}.${a.type === 'video' ? 'mp4' : 'jpg'}`,
      progress: 0,
    }));
    setFiles((f) => [...f, ...next]);
  }

  async function capture() {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return Alert.alert(t('error'), 'Camera permission is required.');
    const res = await ImagePicker.launchCameraAsync({ quality: 0.85 });
    if (res.canceled) return;
    const a = res.assets[0];
    setFiles((f) => [
      ...f,
      {
        id: `${Date.now()}-cam`,
        uri: a.uri,
        kind: 'image',
        mime: a.mimeType ?? 'image/jpeg',
        name: a.fileName ?? `camera-${Date.now()}.jpg`,
        progress: 0,
      },
    ]);
  }

  async function pickDocument() {
    const res = await DocumentPicker.getDocumentAsync({ multiple: true, copyToCacheDirectory: true });
    if (res.canceled) return;
    setFiles((f) => [
      ...f,
      ...res.assets.map((a) => ({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        uri: a.uri,
        kind: (a.mimeType ?? '').startsWith('video/') ? ('video' as const) : ('file' as const),
        mime: a.mimeType ?? 'application/octet-stream',
        name: a.name ?? 'document',
        progress: 0,
      })),
    ]);
  }

  function removeFile(id: string) {
    setFiles((f) => f.filter((x) => x.id !== id));
  }

  async function uploadOne(item: Attachment): Promise<Attachment> {
    try {
      const bucket = item.kind === 'file' ? 'documents' : 'media';
      const res = await uploadWithProgress({
        bucket,
        uri: item.uri,
        fileName: item.name,
        mime: item.mime,
        ownerId: me!.id,
        onProgress: (p) =>
          setFiles((f) => f.map((x) => (x.id === item.id ? { ...x, progress: p } : x))),
      });
      setFiles((f) => f.map((x) => (x.id === item.id ? { ...x, url: res.url, path: res.path, progress: 100 } : x)));
      return { ...item, url: res.url, path: res.path, progress: 100, bucket } as Attachment;
    } catch (e) {
      const msg = (e as Error).message;
      setFiles((f) => f.map((x) => (x.id === item.id ? { ...x, error: msg } : x)));
      throw e;
    }
  }

  async function publish() {
    if (!body.trim() && files.length === 0) return;
    setBusy(true);
    try {
      const uploaded: Attachment[] = [];
      for (const f of files) {
        if (f.url && f.path) { uploaded.push(f); continue; }
        uploaded.push(await uploadOne(f));
      }

      const { data: post, error } = await supabase
        .from('posts')
        .insert({ author_id: me!.id, body: body.trim() || null, visibility })
        .select('id')
        .single();
      if (error) throw new Error(error.message);

      const mediaRows = uploaded
        .filter((u) => u.url && u.path && u.kind !== 'file')
        .map((u) => ({
          owner_id: me!.id,
          bucket: 'media',
          storage_path: u.path!,
          url: u.url!,
          kind: u.kind === 'video' ? 'video' : 'image',
          mime: u.mime,
          post_id: post.id,
        }));
      if (mediaRows.length) {
        const { error: mErr } = await supabase.from('media').insert(mediaRows);
        if (mErr) throw new Error(mErr.message);
      }

      const docs = uploaded.filter((u) => u.kind === 'file' && u.url && u.path);
      if (docs.length) {
        const { error: dErr } = await supabase.from('media').insert(
          docs.map((u) => ({
            owner_id: me!.id,
            bucket: 'documents',
            storage_path: u.path!,
            url: u.url!,
            kind: 'document',
            mime: u.mime,
            post_id: post.id,
          })),
        );
        if (dErr) throw new Error(`Document metadata could not be saved: ${dErr.message}`);
      }

      qc.invalidateQueries({ queryKey: ['feed'] });
      qc.invalidateQueries({ queryKey: ['user-posts', me!.id] });
      qc.invalidateQueries({ queryKey: ['reels'] });
      Alert.alert(t('success'), t('published'));
      router.back();
    } catch (e) {
      Alert.alert(t('error'), (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const readyCount = files.filter((f) => f.url || f.progress === 100).length;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={s.wrap} contentContainerStyle={{ padding: 18, paddingBottom: 140 }} keyboardShouldPersistTaps="handled">
        <Text style={s.h}>{t('new_post')}</Text>

        <TextInput
          value={body}
          onChangeText={setBody}
          placeholder={t('post_placeholder')}
          placeholderTextColor={palette.muted}
          multiline
          style={s.input}
        />

        <Label>{t('visibility')}</Label>
        <ChipRow contentStyle={{ paddingHorizontal: 0 }}>
          {(['public', 'friends', 'private'] as const).map((v) => (
            <Chip key={v} label={t(v)} active={visibility === v} onPress={() => setVisibility(v)} />
          ))}
        </ChipRow>

        <Label>{t('attachments')}</Label>
        <ChipRow contentStyle={{ paddingHorizontal: 0 }}>
          <Chip label={`▣ ${t('gallery')}`} onPress={pickImages} />
          <Chip label={`◉ ${t('camera')}`} onPress={capture} />
          <Chip label={`▤ ${t('file')}`} onPress={pickDocument} />
        </ChipRow>

        {files.map((f) => (
          <View key={f.id} style={s.att}>
            {f.kind === 'image' ? (
              <Image source={{ uri: f.uri }} style={s.thumb} />
            ) : (
              <View style={[s.thumb, s.thumbAlt]}>
                <Text style={{ color: palette.goldSoft, fontSize: 18 }}>{f.kind === 'video' ? '▶' : '▤'}</Text>
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={s.attName} numberOfLines={1}>{f.name}</Text>
              <Text style={s.attMeta} numberOfLines={1}>
                {f.error ? `✕ ${f.error}` : f.url ? `✓ ${t('uploaded')}` : `${f.progress}%`}
              </Text>
              <View style={s.track}>
                <View style={[s.fill, { width: `${f.error ? 100 : f.progress}%`, backgroundColor: f.error ? palette.bad : palette.gold }]} />
              </View>
            </View>
            <Pressable onPress={() => removeFile(f.id)} hitSlop={10}>
              <Text style={{ color: palette.muted, fontSize: 16 }}>✕</Text>
            </Pressable>
          </View>
        ))}

        <Btn
          title={busy ? t('publishing') : `${t('publish')}${files.length ? ` (${readyCount}/${files.length})` : ''}`}
          onPress={publish}
          loading={busy}
          disabled={!body.trim() && files.length === 0}
          style={{ marginTop: 18 }}
        />
        <Text style={s.note}>{t('publish_note')}</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: palette.ink },
  h: { color: palette.text, fontSize: 20, fontWeight: '700', marginBottom: 14 },
  input: {
    backgroundColor: '#0F0F12', borderWidth: 1, borderColor: palette.line, borderRadius: radius.sm,
    color: palette.text, padding: 14, fontSize: 15, minHeight: 130, textAlignVertical: 'top',
    marginBottom: 10, lineHeight: 22,
  },
  att: {
    flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 10,
    borderWidth: 1, borderColor: palette.line, borderRadius: radius.sm, padding: 10,
    backgroundColor: palette.panel,
  },
  thumb: { width: 48, height: 48, borderRadius: 8 },
  thumbAlt: {
    backgroundColor: palette.panel2, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: palette.line,
  },
  attName: { color: palette.text, fontSize: 12, fontWeight: '600' },
  attMeta: { color: palette.muted, fontSize: 10, marginTop: 3 },
  track: { height: 4, borderRadius: 4, backgroundColor: palette.line, marginTop: 6, overflow: 'hidden' },
  fill: { height: 4 },
  note: { color: palette.muted, fontSize: 10, marginTop: 10, lineHeight: 16, textAlign: 'center' },
});
