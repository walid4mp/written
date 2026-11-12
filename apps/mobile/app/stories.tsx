import React, { useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, ScrollView, FlatList, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../src/lib/supabase';
import { activeStories, viewStory } from '../src/lib/api';
import { useAuth } from '../src/lib/auth';
import { useI18n } from '../src/lib/i18n';
import { palette } from '../src/lib/theme';
import { Loader, EmptyState, Btn } from '../src/components/ui';

export default function Stories() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const me = useAuth((s) => s.me);
  const { t } = useI18n();
  const [caption, setCaption] = useState('');
  const [busy, setBusy] = useState(false);
  const q = useQuery({ queryKey: ['stories'], queryFn: activeStories });

  async function publishStory(mediaUrl: string | null, kind: 'image' | 'video' | 'file') {
    if (!me) return;
    setBusy(true);
    try {
      const { error } = await supabase.from('stories').insert({
        author_id: me.id,
        media_url: mediaUrl,
        media_kind: kind === 'file' ? 'image' : kind,
        caption,
        privacy: 'followers',
        expires_at: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
      });
      if (error) throw new Error(error.message);
      setCaption('');
      q.refetch();
    } catch (e) {
      Alert.alert('Could not publish', (e as Error).message);
    }
    setBusy(false);
  }

  async function pickAndUpload() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return Alert.alert('Permission needed', 'Allow photo access to add a story.');
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.All, quality: 0.8 });
    if (res.canceled || !res.assets[0]) return;
    const asset = res.assets[0];
    if (!me) return;
    setBusy(true);
    try {
      const path = `${me.id}/${Date.now()}-${asset.fileName ?? 'story.jpg'}`;
      const arraybuffer = await (await fetch(asset.uri)).arrayBuffer();
      const { error } = await supabase.storage.from('stories').upload(path, arraybuffer, {
        contentType: asset.mimeType ?? 'image/jpeg',
        upsert: false,
      });
      if (error) throw new Error(error.message);
      const { data } = supabase.storage.from('stories').getPublicUrl(path);
      await publishStory(data.publicUrl, asset.type === 'video' ? 'video' : 'image');
    } catch (e) {
      Alert.alert('Upload failed', (e as Error).message);
      setBusy(false);
    }
  }

  return (
    <View style={[s.wrap, { paddingTop: insets.top }]}>
      <View style={s.head}>
        <Pressable onPress={() => router.back()}><Text style={s.x}>✕</Text></Pressable>
        <Text style={s.title}>{t('stories')}</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={s.composer}>
        <TextInput
          value={caption}
          onChangeText={setCaption}
          placeholder="Add a line to your story…"
          placeholderTextColor={palette.muted}
          style={s.input}
        />
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
          <Btn title="Photo / Video" variant="ghost" style={{ flex: 1 }} onPress={pickAndUpload} loading={busy} />
          <Btn title="Text only" style={{ flex: 1 }} onPress={() => publishStory(null, 'image')} loading={busy} />
        </View>
      </View>

      <Text style={s.section}>ACTIVE STORIES</Text>
      {q.isLoading ? <Loader /> : (q.data?.length ?? 0) === 0 ? <EmptyState text={t('empty')} /> : (
        <FlatList
          data={q.data}
          keyExtractor={(x: any) => x.id}
          numColumns={2}
          columnWrapperStyle={{ gap: 10, paddingHorizontal: 16 }}
          contentContainerStyle={{ gap: 10, paddingBottom: 40 }}
          renderItem的事={undefined as never}
          renderItem={({ item }: any) => (
            <Pressable
              style={s.tile}
              onPress={() => me && viewStory(item.id, me.id).catch(() => {})}
            >
              <Text style={s.tileGlyph}>{item.media_kind === 'video' ? '▶' : '❖'}</Text>
              <Text style={s.tileAuthor} numberOfLines={1}>{item.author?.display_name}</Text>
              {item.caption ? <Text style={s.tileCap} numberOfLines={2}>{item.caption}</Text> : null}
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#0A0A0B' },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 12 },
  x: { color: palette.text, fontSize: 18 },
  title: { color: palette.text, fontSize: 14, fontWeight: '600' },
  composer: { margin: 16, padding: 14, borderRadius: 14, borderWidth: 1, borderColor: palette.line, backgroundColor: palette.panel },
  input: { color: palette.text, fontSize: 13, borderBottomWidth: 1, borderBottomColor: palette.line, paddingVertical: 8 },
  section: { color: palette.muted, fontSize: 9, letterSpacing: 2, marginHorizontal: 18, marginBottom: 10 },
  tile: { flex: 1, height: 190, borderRadius: 12, backgroundColor: palette.panel2, borderWidth: 1, borderColor: palette.line, padding: 12, justifyContent: 'flex-end' },
  tileGlyph: { position: 'absolute', top: 12, right: 12, color: palette.gold + 'aa' },
  tileAuthor: { color: palette.goldSoft, fontSize: 10, fontWeight: '600' },
  tileCap: { color: palette.text, fontSize: 12, marginTop: 4, lineHeight: 16 },
});
