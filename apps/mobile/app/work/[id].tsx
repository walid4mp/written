import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, TextInput, Share } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getWork, getChapters, listComments, addComment, rateWork,
  toggleLike, toggleLibrary, isInLibrary, toggleFollow, getMyProgress, reportContent,
} from '../../src/lib/api';
import { useAuth } from '../../src/lib/auth';
import { useI18n } from '../../src/lib/i18n';
import { palette, radius } from '../../src/lib/theme';
import { Loader, EmptyState, Badge, Btn } from '../../src/components/ui';

export default function WorkDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const me = useAuth((s) => s.me);
  const { t } = useI18n();
  const qc = useQueryClient();
  const [tab, setTab] = useState<'info' | 'reviews' | 'similar'>('info');
  const [comment, setComment] = useState('');
  const [saved, setSaved] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  const work = useQuery({ queryKey: ['work', id], queryFn: () => getWork(id!) });
  const chapters = useQuery({ queryKey: ['chapters', id], queryFn: () => getChapters(id!), enabled: !!id });
  const comments = useQuery({ queryKey: ['comments', 'work', id], queryFn: () => listComments('work', id!) });
  const progress = useQuery({ queryKey: ['progress', id, me?.id], queryFn: () => getMyProgress(id!, me!.id), enabled: !!me?.id && !!id });

  React.useEffect(() => {
    if (me?.id && id) isInLibrary(id, me.id).then(setSaved);
  }, [me?.id, id]);

  if (work.isLoading) return <Loader text={t('loading')} />;
  if (work.error) return <EmptyState text={(work.error as Error).message} />;
  if (!work.data) return <EmptyState text={t('empty')} />;

  const w = work.data;
  const resume = progress.data?.chapter_id
    ? chapters.data?.find((c) => c.id === progress.data!.chapter_id)
    : chapters.data?.[0];

  async function handleSave() {
    if (!me) return;
    setSaved(await toggleLibrary(w.id, me.id));
  }

  async function handleFollow() {
    if (!me) return;
    await toggleFollow(w.author_id, me.id);
    qc.invalidateQueries({ queryKey: ['work', id] });
  }

  async function submitComment() {
    if (!me || !comment.trim()) return;
    setBusy(true);
    try {
      await addComment({ authorId: me.id, targetType: 'work', targetId: w.id, body: comment.trim() });
      setComment('');
      comments.refetch();
    } finally { setBusy(false); }
  }

  return (
    <ScrollView style={s.wrap} contentContainerStyle={{ paddingBottom: 40 }}>
      <View style={s.coverWrap}>
        <View style={s.book}>
          <Text style={s.bookGlyph}>❖</Text>
          <Text style={s.bookTitle} numberOfLines={4}>{w.title}</Text>
          <Text style={s.bookAuthor} numberOfLines={1}>{w.author?.display_name}</Text>
        </View>
      </View>

      <Text style={s.title}>{w.title}</Text>
      <Pressable onPress={() => router.push(`/profile/${w.author_id}`)}>
        <Text style={s.author}>{w.author?.display_name} {w.author?.is_verified ? '✓' : ''}</Text>
      </Pressable>
      <Text style={s.synopsis}>{w.synopsis}</Text>

      <View style={s.stats}>
        <Stat icon="★" label={t('rating')} value={Number(w.rating_avg).toFixed(1)} />
        <Stat icon="▤" label={t('chapters')} value={String(w.chapters_count)} />
        <Stat icon="◉" label={t('reads')} value={w.reads_count > 999 ? `${(w.reads_count / 1000).toFixed(1)}k` : String(w.reads_count)} />
      </View>

      <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 18, marginTop: 18 }}>
        <Btn
          title={progress.data ? t('continue_reading') : t('start_reading')}
          style={{ flex: 1 }}
          onPress={() => resume && router.push(`/read/${w.id}?chapter=${resume.id}`)}
          disabled={!resume}
        />
        <Pressable onPress={handleSave} style={s.iconBtn}><Text style={{ color: palette.goldSoft, fontSize: 16 }}>{saved ? '🔖' : '❐'}</Text></Pressable>
        <Pressable
          onPress={() => Share.share({ message: `${w.title} — ${w.author?.display_name} · SARAD` })}
          style={s.iconBtn}
        >
          <Text style={{ color: palette.goldSoft, fontSize: 15 }}>⌲</Text>
        </Pressable>
      </View>

      <View style={s.tabs}>
        {(['info', 'reviews', 'similar'] as const).map((k) => (
          <Pressable key={k} onPress={() => setTab(k)} style={[s.tab, tab === k && s.tabOn]}>
            <Text style={[s.tabTxt, tab === k && { color: palette.goldSoft }]}>{k.toUpperCase()}</Text>
          </Pressable>
        ))}
      </View>

      {tab === 'info' && (
        <View style={{ paddingHorizontal: 18 }}>
          <Text style={s.h3}>Overview</Text>
          <Text style={s.body}>{w.synopsis || '—'}</Text>
          <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginTop: 12 }}>
            {w.genres.map((g) => <Badge key={g} text={g} />)}
            {w.tags.map((g) => <Badge key={g} text={`#${g}`} tone="ok" />)}
          </View>

          <Text style={[s.h3, { marginTop: 22 }]}>Chapters</Text>
          {(chapters.data ?? []).map((c) => (
            <Pressable key={c.id} style={s.chRow} onPress={() => router.push(`/read/${w.id}?chapter=${c.id}`)}>
              <Text style={s.chNum}>{String(c.chapter_number).padStart(2, '0')}</Text>
              <View style={{ flex: 1 }}>
                <Text style={s.chTitle}>{c.title || `Chapter ${c.chapter_number}`}</Text>
                <Text style={s.chMeta}>{c.words_count} words</Text>
              </View>
              <Text style={{ color: palette.goldSoft }}>→</Text>
            </Pressable>
          ))}
          {(chapters.data ?? []).length === 0 && <Text style={s.body}>No chapters published yet.</Text>}

          <Text style={[s.h3, { marginTop: 22 }]}>Rate this work</Text>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {[1, 2, 3, 4, 5].map((n) => (
              <Pressable key={n} onPress={() => me && rateWork(w.id, me.id, n).then(() => work.refetch())}>
                <Text style={{ color: n <= Math.round(Number(w.rating_avg)) ? palette.gold : palette.line, fontSize: 26 }}>★</Text>
              </Pressable>
            ))}
          </View>

          <Pressable style={{ marginTop: 22 }} onPress={() => me && reportContent({ reporterId: me.id, targetType: 'work', targetId: w.id, reason: 'user_report' })}>
            <Text style={{ color: palette.muted, fontSize: 11 }}>⚑ {t('report')}</Text>
          </Pressable>
        </View>
      )}

      {tab === 'reviews' && (
        <View style={{ paddingHorizontal: 18 }}>
          {me ? (
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
              <TextInput
                value={comment}
                onChangeText={setComment}
                placeholder={`${t('comment')}…`}
                placeholderTextColor={palette.muted}
                style={s.input}
              />
              <Btn title={t('send')} onPress={submitComment} loading={busy} disabled={!comment.trim()} />
            </View>
          ) : null}
          {(comments.data ?? []).length === 0 ? <EmptyState text={t('empty')} /> : (
            (comments.data ?? []).map((c: any) => (
              <View key={c.id} style={s.comment}>
                <Text style={s.cAuthor}>{c.author?.display_name} {c.author?.is_verified ? '✓' : ''}</Text>
                <Text style={s.cBody}>{c.body}</Text>
                <Pressable onPress={() => me && toggleLike('comment', c.id, me.id).then(() => comments.refetch())}>
                  <Text style={s.cLike}>♥ {c.likes_count}</Text>
                </Pressable>
              </View>
            ))
          )}
        </View>
      )}

      {tab === 'similar' && (
        <View style={{ paddingHorizontal: 18 }}>
          <Text style={s.body}>Open Discover to explore more {w.kind.replace('_', ' ')} in {w.language.toUpperCase()}.</Text>
          <Btn title={t('discover')} onPress={() => router.push('/(tabs)/discover')} style={{ marginTop: 12 }} />
        </View>
      )}
    </ScrollView>
  );
}

function Stat({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Text style={{ color: palette.gold, fontSize: 13 }}>{icon}</Text>
      <Text style={{ color: palette.muted, fontSize: 9, marginTop: 3 }}>{label}</Text>
      <Text style={{ color: palette.text, fontSize: 14, fontWeight: '700', marginTop: 2 }}>{value}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: palette.ink },
  coverWrap: { alignItems: 'center', paddingTop: 12, paddingBottom: 22 },
  book: {
    width: 148, height: 212, borderRadius: 10, backgroundColor: '#1B1820',
    borderWidth: 1, borderColor: palette.gold + '44', padding: 14, justifyContent: 'space-between',
    shadowColor: palette.gold, shadowOpacity: 0.18, shadowRadius: 22, shadowOffset: { width: 0, height: 12 }, elevation: 8,
  },
  bookGlyph: { color: palette.gold + 'aa', fontSize: 14 },
  bookTitle: { color: palette.text, fontSize: 15, fontWeight: '700', lineHeight: 20 },
  bookAuthor: { color: palette.goldSoft, fontSize: 10 },
  title: { color: palette.text, fontSize: 22, fontWeight: '700', textAlign: 'center', paddingHorizontal: 18 },
  author: { color: palette.goldSoft, fontSize: 12, textAlign: 'center', marginTop: 6 },
  synopsis: { color: palette.muted, fontSize: 12, lineHeight: 20, paddingHorizontal: 18, marginTop: 12 },
  stats: { flexDirection: 'row', marginHorizontal: 18, marginTop: 16, paddingVertical: 12, borderTopWidth: 1, borderBottomWidth: 1, borderColor: palette.line },
  iconBtn: { width: 46, alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm, borderWidth: 1, borderColor: palette.gold + '66' },
  tabs: { flexDirection: 'row', gap: 18, paddingHorizontal: 18, marginTop: 22, borderBottomWidth: 1, borderBottomColor: palette.line },
  tab: { paddingBottom: 10 },
  tabOn: { borderBottomWidth: 2, borderBottomColor: palette.gold },
  tabTxt: { color: palette.muted, fontSize: 11, letterSpacing: 1 },
  h3: { color: palette.text, fontSize: 15, fontWeight: '600', marginBottom: 8, marginTop: 14 },
  body: { color: palette.muted, fontSize: 12, lineHeight: 20 },
  chRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: palette.line },
  chNum: { color: palette.gold, fontSize: 12, width: 22 },
  chTitle: { color: palette.text, fontSize: 13, fontWeight: '600' },
  chMeta: { color: palette.muted, fontSize: 10, marginTop: 2 },
  input: { flex: 1, backgroundColor: '#0F0F12', borderWidth: 1, borderColor: palette.line, borderRadius: radius.sm, color: palette.text, paddingHorizontal: 12, paddingVertical: 9, fontSize: 13 },
  comment: { borderBottomWidth: 1, borderBottomColor: palette.line, paddingVertical: 12 },
  cAuthor: { color: palette.goldSoft, fontSize: 11, fontWeight: '600' },
  cBody: { color: palette.text, fontSize: 13, marginTop: 5, lineHeight: 19 },
  cLike: { color: palette.muted, fontSize: 11, marginTop: 6 },
});
