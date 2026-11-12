import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, ScrollView, StyleSheet, Pressable, KeyboardAvoidingView, Platform, Alert, Image } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  createWork, updateWork, publishWork, listChaptersForEdit, upsertChapter, canPublish, getWork,
} from '../../src/lib/api';
import { useAuth } from '../../src/lib/auth';
import { useI18n } from '../../src/lib/i18n';
import { palette, radius } from '../../src/lib/theme';
import { Btn, Field, Loader, Badge } from '../../src/components/ui';
import * as ImagePicker from 'expo-image-picker';
import { uploadWithProgress } from '../../src/lib/upload';

const KINDS = ['novel', 'short_story', 'tale', 'poetry', 'article'] as const;

export default function Editor() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const me = useAuth((s) => s.me);
  const { t, lang } = useI18n();

  const isNew = id === 'new';
  const [workId, setWorkId] = useState<string | null>(isNew ? null : (id as string));
  const [title, setTitle] = useState('');
  const [synopsis, setSynopsis] = useState('');
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [coverBusy, setCoverBusy] = useState(false);
  const [kind, setKind] = useState<string>('novel');
  const [genres, setGenres] = useState('');
  const [tags, setTags] = useState('');
  const [chTitle, setChTitle] = useState('');
  const [chBody, setChBody] = useState('');
  const [chapters, setChapters] = useState<any[]>([]);
  const [status, setStatus] = useState('draft');
  const [policy, setPolicy] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState('');

  const dirty = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    (async () => {
      const p = await canPublish();
      setPolicy(p);
      if (!isNew) {
        const w = await getWork(id as string);
        setTitle(w.title);
        setSynopsis(w.synopsis ?? '');
        setCoverUrl(w.cover_url ?? null);
        setKind(w.kind);
        setGenres(w.genres.join(', '));
        setTags(w.tags.join(', '));
        setStatus(w.status);
        setChapters(await listChaptersForEdit(id as string));
      }
    })();
  }, [id]);

  // Autosave: metadata every 4s after a change
  useEffect(() => {
    if (!workId) return;
    dirty.current = true;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      if (!dirty.current) return;
      await updateWork(workId, {
        title: title || 'Untitled',
        synopsis,
        cover_url: coverUrl,
        kind,
        genres: genres.split(',').map((g) => g.trim()).filter(Boolean),
        tags: tags.split(',').map((g) => g.trim().replace('#', '')).filter(Boolean),
      });
      setNote(t('draft_saved'));
      setTimeout(() => setNote(''), 2200);
    }, 4000);
  }, [title, synopsis, coverUrl, kind, genres, tags, workId]);

  async function ensureWork() {
    if (workId) return workId;
    const newId = await createWork({
      authorId: me!.id,
      title: title || 'Untitled',
      synopsis,
      kind,
      language: lang,
      genres: genres.split(',').map((g) => g.trim()).filter(Boolean),
      tags: tags.split(',').map((g) => g.trim()).filter(Boolean),
    });
    if (coverUrl) await updateWork(newId, { cover_url: coverUrl });
    setWorkId(newId);
    return newId;
  }

  async function chooseCover() {
    if (!me) return;
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission required', 'Allow SARAD to access your photos to choose a book cover.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [2, 3],
      quality: 0.9,
    });
    if (result.canceled || !result.assets[0]) return;
    setCoverBusy(true);
    try {
      const asset = result.assets[0];
      const ext = (asset.fileName?.split('.').pop() || 'jpg').toLowerCase();
      const uploaded = await uploadWithProgress({
        bucket: 'covers',
        uri: asset.uri,
        fileName: `work-cover.${ext}`,
        mime: asset.mimeType || 'image/jpeg',
        ownerId: me.id,
      });
      setCoverUrl(uploaded.url);
      if (workId) await updateWork(workId, { cover_url: uploaded.url });
      setNote('Cover uploaded and saved ✓');
    } catch (error) {
      Alert.alert('Cover upload failed', (error as Error).message);
    } finally {
      setCoverBusy(false);
    }
  }

  async function saveChapter(publish: boolean) {
    if (!me) return;
    if (!chBody.trim() && !chTitle.trim()) {
      Alert.alert('Nothing to save', 'Write a chapter title or body first.');
      return;
    }
    setSaving(true);
    try {
      const wid = await ensureWork();
      const number = chapters.length + 1;
      const cid = await upsertChapter({
        workId: wid,
        title: chTitle || `Chapter ${number}`,
        content: chBody,
        number,
        publish,
      });
      setChapters(await listChaptersForEdit(wid));
      setChTitle('');
      setChBody('');
      setNote(publish ? 'Chapter published' : 'Chapter saved as draft');
      setTimeout(() => setNote(''), 2200);
    } catch (e) {
      Alert.alert('Could not save', (e as Error).message);
    }
    setSaving(false);
  }

  async function doPublish() {
    if (!me) return;
    const check = await canPublish();
    setPolicy(check);
    if (!check.allowed) {
      Alert.alert(
        'Publish limit reached',
        check.reason === 'payment_required'
          ? `Your free works are used up. Publishing costs ${check.price} ${check.currency}.`
          : check.reason === 'subscription_required'
            ? 'An active subscription is required to publish.'
            : 'Publishing is currently unavailable.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Go to plans', onPress: () => router.push('/subscription') },
        ],
      );
      return;
    }
    setSaving(true);
    try {
      const wid = await ensureWork();
      const res = await publishWork(wid);
      setStatus(res?.status ?? 'published');
      setNote(res?.status === 'pending_review' ? 'Submitted for editorial review' : 'Published ✓');
      setTimeout(() => setNote(''), 2600);
    } catch (e) {
      Alert.alert('Publish failed', (e as Error).message);
    }
    setSaving(false);
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: palette.ink }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: insets.bottom + 90 }} keyboardShouldPersistTaps="handled">
        <View style={s.head}>
          <View>
            <Text style={s.h1}>{isNew ? t('new_work') : 'Edit work'}</Text>
            <Text style={s.sub}>
              {policy?.allowed
                ? policy.reason === 'free_quota'
                  ? `${t('free_quota')}: ${Math.max(0, (policy.limit ?? 3) - (policy.used ?? 0))}`
                  : policy.reason === 'exempt'
                    ? `${t('exempt')} ✓`
                    : policy.reason === 'unlimited_grant'
                      ? `${t('unlimited')} ✓`
                      : policy.reason === 'subscription'
                        ? 'Subscription active ✓'
                        : 'Publishing allowed ✓'
                : `Payment required · ${policy?.price ?? '—'} ${policy?.currency ?? ''}`}
            </Text>
          </View>
          <Badge text={status} tone={status === 'published' ? 'ok' : 'gold'} />
        </View>

        {note ? <Text style={s.note}>{note}</Text> : null}

        <Field label={t('title')} value={title} onChangeText={setTitle} placeholder="عنوان العمل" />
        <Field label={t('synopsis')} value={synopsis} onChangeText={setSynopsis} multiline placeholder="..." style={{ minHeight: 90 }} />

        <View style={{ marginTop: 12, marginBottom: 14 }}>
          <Text style={s.label}>Book cover / غلاف العمل</Text>
          {coverUrl ? <Image source={{ uri: coverUrl }} style={{ width: 112, height: 158, borderRadius: 10, marginBottom: 10 }} /> : null}
          <Btn title={coverBusy ? 'Uploading cover…' : coverUrl ? 'Change cover image' : 'Choose cover image'} variant="ghost" onPress={chooseCover} loading={coverBusy} />
        </View>

        <Text style={s.label}>{t('genre')}</Text>
        <View style={s.kinds}>
          {KINDS.map((k) => (
            <Pressable key={k} onPress={() => setKind(k)} style={[s.kind, kind === k && s.kindOn]}>
              <Text style={{ color: kind === k ? '#1A1405' : palette.muted, fontSize: 11 }}>{k.replace('_', ' ')}</Text>
            </Pressable>
          ))}
        </View>

        <Field label={`${t('genre')} (genres)`} value={genres} onChangeText={setGenres} placeholder="fantasy, drama" />
        <Field label={t('tags')} value={tags} onChangeText={setTags} placeholder="dark, epic" />

        <Text style={[s.label, { marginTop: 12 }]}>{t('add_chapter')}</Text>
        <Field value={chTitle} onChangeText={setChTitle} placeholder="Chapter title" />
        <TextInput
          value={chBody}
          onChangeText={setChBody}
          multiline
          placeholder="Write the chapter…"
          placeholderTextColor={palette.muted}
          style={s.body}
        />

        <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
          <Btn title={t('save_draft')} variant="ghost" style={{ flex: 1 }} onPress={() => saveChapter(false)} loading={saving} />
          <Btn title={t('publish')} style={{ flex: 1 }} onPress={() => saveChapter(true)} loading={saving} />
        </View>

        {chapters.length > 0 && (
          <>
            <Text style={[s.label, { marginTop: 24 }]}>{t('chapters')} ({chapters.length})</Text>
            {chapters.map((c) => (
              <View key={c.id} style={s.chRow}>
                <Text style={s.chNum}>{String(c.chapter_number).padStart(2, '0')}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={s.chTitle}>{c.title}</Text>
                  <Text style={s.chMeta}>{c.words_count} words · {c.status}</Text>
                </View>
                <Pressable onPress={() => { setChTitle(c.title); setChBody(c.content); }}>
                  <Text style={{ color: palette.goldSoft, fontSize: 11 }}>edit</Text>
                </Pressable>
              </View>
            ))}
          </>
        )}

        <View style={s.publishBar}>
          <Btn
            title={status === 'published' ? 'Republish' : t('publish')}
            onPress={doPublish}
            loading={saving}
            style={{ flex: 1 }}
          />
        </View>
        <Text style={s.hint}>
          Autosave is on. Nothing goes live until you press publish. If editorial review is enabled
          your work appears to you as “pending review” until an editor approves it.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  h1: { color: palette.text, fontSize: 22, fontWeight: '700' },
  sub: { color: palette.goldSoft, fontSize: 11, marginTop: 4 },
  note: { color: palette.ok, fontSize: 11, marginBottom: 12 },
  label: { color: palette.muted, fontSize: 10, letterSpacing: 1.5, marginBottom: 8, textTransform: 'uppercase' },
  kinds: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  kind: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, borderWidth: 1, borderColor: palette.line },
  kindOn: { backgroundColor: palette.gold, borderColor: 'transparent' },
  body: {
    backgroundColor: '#0F0F12', borderWidth: 1, borderColor: palette.line, borderRadius: radius.sm,
    color: palette.text, padding: 14, minHeight: 200, fontSize: 15, lineHeight: 24, textAlignVertical: 'top',
  },
  chRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: palette.line },
  chNum: { color: palette.gold, fontSize: 11, width: 22 },
  chTitle: { color: palette.text, fontSize: 13, fontWeight: '600' },
  chMeta: { color: palette.muted, fontSize: 10, marginTop: 2 },
  publishBar: { flexDirection: 'row', marginTop: 24 },
  hint: { color: palette.muted, fontSize: 10, lineHeight: 16, marginTop: 12 },
});
