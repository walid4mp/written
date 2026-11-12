import React, { useState } from 'react';
import { View, Text, FlatList, StyleSheet, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { myLibrary, myWorks } from '../../src/lib/api';
import { useAuth } from '../../src/lib/auth';
import { useI18n } from '../../src/lib/i18n';
import { palette } from '../../src/lib/theme';
import { Loader, EmptyState, ErrorState, Badge, ChipRow, Chip, Btn } from '../../src/components/ui';

type Tab = 'saved' | 'reading' | 'mine';

export default function Library() {
  const { t } = useI18n();
  const router = useRouter();
  const me = useAuth((s) => s.me);
  const [tab, setTab] = useState<Tab>('saved');

  const lib = useQuery({
    queryKey: ['library', me?.id],
    queryFn: () => myLibrary(me!.id),
    enabled: !!me?.id,
  });

  const mine = useQuery({
    queryKey: ['my-works', me?.id],
    queryFn: () => myWorks(me!.id),
    enabled: !!me?.id,
  });

  const active = tab === 'mine' ? mine : lib;
  const items = (lib.data ?? []).filter((x) => (tab === 'saved' ? x.collection === 'saved' : x.collection === 'reading'));
  const empty = tab === 'mine' ? (mine.data?.length ?? 0) === 0 : items.length === 0;

  if (!me) {
    return (
      <View style={s.wrap}>
        <EmptyState
          text={t('sign_in')}
          action={<Btn title={t('sign_in')} onPress={() => router.push('/(auth)/sign-in')} />}
        />
      </View>
    );
  }

  return (
    <View style={s.wrap}>
      <ChipRow>
        <Chip label={t('saved')} active={tab === 'saved'} onPress={() => setTab('saved')} />
        <Chip label={t('progress')} active={tab === 'reading'} onPress={() => setTab('reading')} />
        <Chip label={t('my_works')} active={tab === 'mine'} onPress={() => setTab('mine')} />
      </ChipRow>

      {active.isLoading ? (
        <Loader text={t('loading')} />
      ) : active.error ? (
        <ErrorState text={(active.error as Error).message} onRetry={() => active.refetch()} />
      ) : empty ? (
        <EmptyState
          text={t('empty')}
          action={
            <Btn
              title={tab === 'mine' ? t('new_work') : t('discover')}
              variant="soft"
              onPress={() => router.push(tab === 'mine' ? '/editor/new' : '/(tabs)/discover')}
            />
          }
        />
      ) : tab === 'mine' ? (
        <FlatList
          data={mine.data as any[]}
          keyExtractor={(w: any) => w.id}
          contentContainerStyle={s.list}
          renderItem={({ item }: any) => (
            <Pressable style={s.row} onPress={() => router.push(item.status === 'draft' ? `/editor/${item.id}` : `/work/${item.id}`)}>
              <View style={s.thumb}><Text style={{ color: palette.gold + 'aa' }}>❖</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={s.title} numberOfLines={1}>{item.title}</Text>
                <Text style={s.meta} numberOfLines={1}>
                  {item.kind} · {item.chapters_count} {t('chapters')} · {item.reads_count} {t('reads')}
                </Text>
              </View>
              <Badge text={item.status} tone={item.status === 'published' ? 'ok' : 'gold'} />
            </Pressable>
          )}
        />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(x) => x.work?.id ?? x.created_at}
          contentContainerStyle={s.list}
          renderItem={({ item }) => (
            <Pressable style={s.row} onPress={() => router.push(`/work/${item.work.id}`)}>
              <View style={s.thumb}><Text style={{ color: palette.gold + 'aa' }}>❖</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={s.title} numberOfLines={1}>{item.work.title}</Text>
                <Text style={s.meta} numberOfLines={1}>
                  {item.work.author?.display_name} · {item.work.chapters_count} {t('chapters')}
                </Text>
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
  wrap: { flex: 1, backgroundColor: palette.ink },
  list: { paddingHorizontal: 18, paddingBottom: 120 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: palette.line,
  },
  thumb: {
    width: 46, height: 64, borderRadius: 8, backgroundColor: palette.panel2,
    borderWidth: 1, borderColor: palette.line, alignItems: 'center', justifyContent: 'center',
  },
  title: { color: palette.text, fontSize: 14, fontWeight: '600' },
  meta: { color: palette.muted, fontSize: 11, marginTop: 4 },
});
