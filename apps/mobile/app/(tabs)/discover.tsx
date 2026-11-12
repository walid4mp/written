import React, { useMemo, useState } from 'react';
import { View, Text, TextInput, FlatList, StyleSheet, Pressable, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { listWorks } from '../../src/lib/api';
import { useI18n } from '../../src/lib/i18n';
import { palette, radius } from '../../src/lib/theme';
import { Loader, EmptyState, ErrorState, Badge, ChipRow, Chip } from '../../src/components/ui';

const KINDS = [
  { key: 'all', ar: 'لك', fr: 'Pour vous', en: 'For you' },
  { key: 'novel', ar: 'روايات', fr: 'Romans', en: 'Novels' },
  { key: 'short_story', ar: 'قصص', fr: 'Nouvelles', en: 'Stories' },
  { key: 'tale', ar: 'حكايات', fr: 'Contes', en: 'Tales' },
  { key: 'poetry', ar: 'شعر', fr: 'Poésie', en: 'Poetry' },
  { key: 'article', ar: 'مقالات', fr: 'Articles', en: 'Articles' },
];

export default function Discover() {
  const { t, lang } = useI18n();
  const router = useRouter();
  const [q, setQ] = useState('');
  const [kind, setKind] = useState('all');
  const [submitted, setSubmitted] = useState('');

  const works = useQuery({
    queryKey: ['works', 'discover', submitted, kind],
    queryFn: () => listWorks({ q: submitted, kind, limit: 40 }),
  });

  const results = useMemo(() => works.data ?? [], [works.data]);

  return (
    <View style={s.wrap}>
      <View style={s.searchBox}>
        <Text style={s.searchIcon}>⌕</Text>
        <TextInput
          value={q}
          onChangeText={setQ}
          onSubmitEditing={() => setSubmitted(q)}
          placeholder={t('search')}
          placeholderTextColor={palette.muted}
          style={s.searchInput}
          returnKeyType="search"
        />
        {q ? (
          <Pressable onPress={() => { setQ(''); setSubmitted(''); }} hitSlop={8}>
            <Text style={{ color: palette.muted }}>✕</Text>
          </Pressable>
        ) : null}
      </View>

      <ChipRow>
        {KINDS.map((k) => (
          <Chip key={k.key} label={(k as any)[lang] ?? k.en} active={kind === k.key} onPress={() => setKind(k.key)} />
        ))}
      </ChipRow>

      <Text style={s.head}>{submitted ? `“${submitted}”` : t('recommended')}</Text>

      {works.isLoading ? (
        <Loader text={t('loading')} />
      ) : works.error ? (
        <ErrorState text={(works.error as Error).message} onRetry={() => works.refetch()} />
      ) : results.length === 0 ? (
        <EmptyState text={submitted ? t('no_results') : t('empty')} />
      ) : (
        <FlatList
          data={results}
          keyExtractor={(w) => w.id}
          contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 120 }}
          renderItem={({ item }) => (
            <Pressable style={s.row} onPress={() => router.push(`/work/${item.id}`)}>
              <View style={s.thumb}>
                {item.cover_url
                  ? <Image source={{ uri: item.cover_url }} style={s.thumbImg} />
                  : <Text style={s.thumbGlyph}>❖</Text>}
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={s.title} numberOfLines={1}>{item.title}</Text>
                  {item.is_premium && <Badge text="PREMIUM" />}
                </View>
                <Text style={s.author} numberOfLines={1}>
                  {item.author?.display_name} {item.author?.is_verified ? '✔' : ''}
                </Text>
                <View style={{ flexDirection: 'row', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                  <Text style={s.tag}>★ {Number(item.rating_avg).toFixed(1)}</Text>
                  <Text style={s.tag}>{item.chapters_count} {t('chapters')}</Text>
                  {(item.genres ?? []).slice(0, 2).map((g) => <Text key={g} style={s.tag}>{g}</Text>)}
                </View>
              </View>
              <Text style={{ color: palette.goldSoft }}>›</Text>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: palette.ink, paddingTop: 6 },
  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 18,
    backgroundColor: '#0F0F12', borderWidth: 1, borderColor: palette.line,
    borderRadius: radius.sm, paddingHorizontal: 12, height: 46,
  },
  searchIcon: { color: palette.muted, fontSize: 16 },
  searchInput: { flex: 1, color: palette.text, paddingVertical: 8, fontSize: 14, textAlign: 'auto' },
  head: {
    color: palette.text, fontSize: 17, fontWeight: '600', paddingHorizontal: 18,
    marginBottom: 10, marginTop: 2, fontFamily: 'CormorantGaramond_600SemiBold',
  },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: palette.line,
  },
  thumb: {
    width: 54, height: 76, borderRadius: 8, backgroundColor: palette.panel2,
    borderWidth: 1, borderColor: palette.line, alignItems: 'center',
    justifyContent: 'center', overflow: 'hidden',
  },
  thumbImg: { width: 54, height: 76 },
  thumbGlyph: { color: palette.gold + 'aa' },
  title: { color: palette.text, fontSize: 14, fontWeight: '600', flexShrink: 1 },
  author: { color: palette.goldSoft, fontSize: 11, marginTop: 3 },
  tag: {
    color: palette.muted, fontSize: 10, borderWidth: 1, borderColor: palette.line,
    borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2,
  },
});
