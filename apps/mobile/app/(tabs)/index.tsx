import React from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { listWorks, activeStories, listFeed, type Work } from '../../src/lib/api';
import { useAuth } from '../../src/lib/auth';
import { useI18n } from '../../src/lib/i18n';
import { palette, radius } from '../../src/lib/theme';
import { Loader, EmptyState, ErrorState, Avatar, Btn } from '../../src/components/ui';

function CoverCard({ work, onPress }: { work: Work; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={s.card}>
      <View style={s.cover}>
        <Text style={s.coverGlyph}>❖</Text>
        <Text style={s.coverTitle} numberOfLines={3}>{work.title}</Text>
        <View style={s.coverFoot}>
          <Text style={s.coverAuthor} numberOfLines={1}>{work.author?.display_name ?? ''}</Text>
        </View>
      </View>
      <Text style={s.cardTitle} numberOfLines={1}>{work.title}</Text>
      <Text style={s.cardMeta} numberOfLines={1}>★ {Number(work.rating_avg).toFixed(1)} · {work.chapters_count}</Text>
    </Pressable>
  );
}

export default function Home() {
  const { t } = useI18n();
  const router = useRouter();
  const me = useAuth((st) => st.me);

  const works = useQuery({ queryKey: ['works', 'home'], queryFn: () => listWorks({ limit: 20 }) });
  const stories = useQuery({ queryKey: ['stories'], queryFn: activeStories });
  const feed = useQuery({ queryKey: ['feed'], queryFn: () => listFeed(12) });

  const latest = works.data?.[0];
  const rest = works.data?.slice(1) ?? [];
  const refreshing = works.isFetching || feed.isFetching;

  return (
    <View style={s.wrap}>
      <View style={s.head}>
        <View style={{ flex: 1 }}>
          <Text style={s.hiya} numberOfLines={1}>{me ? `— ${me.display_name}` : t('tagline')}</Text>
          <Text style={s.brand}>SARAD</Text>
        </View>
        <Pressable onPress={() => router.push('/reels')} style={s.bell} accessibilityLabel={t('reels')}>
          <Text style={{ color: palette.goldSoft, fontSize: 15 }}>▶</Text>
        </Pressable>
        <Pressable onPress={() => router.push('/notifications')} style={s.bell} accessibilityLabel={t('notifications')}>
          <Text style={{ color: palette.goldSoft }}>🔔</Text>
        </Pressable>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 130 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { works.refetch(); stories.refetch(); feed.refetch(); }}
            tintColor={palette.gold}
          />
        }
      >
        {(stories.data?.length ?? 0) > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.storyRow}>
            {(stories.data ?? []).slice(0, 12).map((st: any) => (
              <Pressable key={st.id} onPress={() => router.push('/stories')} style={s.story}>
                <View style={s.storyRing}>
                  <View style={s.storyInner}>
                    <Avatar uri={st.author?.avatar_url} name={st.author?.display_name} size={54} />
                  </View>
                </View>
                <Text style={s.storyName} numberOfLines={1}>{st.author?.display_name ?? ''}</Text>
              </Pressable>
            ))}
          </ScrollView>
        )}

        {works.isLoading ? (
          <Loader text={t('loading')} />
        ) : works.error ? (
          <ErrorState text={(works.error as Error).message} onRetry={() => works.refetch()} />
        ) : !latest ? (
          <EmptyState
            text={t('empty')}
            action={<Btn title={t('new_work')} variant="soft" onPress={() => router.push('/editor/new')} />}
          />
        ) : (
          <>
            <Pressable onPress={() => router.push(`/work/${latest.id}`)} style={s.hero}>
              <View style={s.heroShade} />
              <Text style={s.heroKicker}>FEATURED</Text>
              <Text style={s.heroTitle} numberOfLines={2}>{latest.title}</Text>
              <Text style={s.heroAuthor}>{latest.author?.display_name} {latest.author?.is_verified ? '✔' : ''}</Text>
              <Text style={s.heroSyn} numberOfLines={3}>{latest.synopsis}</Text>
              <View style={s.heroBtn}><Text style={s.heroBtnTxt}>{t('start_reading')}</Text></View>
            </Pressable>

            <View style={s.sectionHead}>
              <Text style={s.h2}>{t('recommended')}</Text>
              <Pressable onPress={() => router.push('/(tabs)/discover')}>
                <Text style={s.more}>{t('discover')} →</Text>
              </Pressable>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 18, gap: 12, alignItems: 'flex-start' }}
            >
              {rest.map((item) => (
                <CoverCard key={item.id} work={item} onPress={() => router.push(`/work/${item.id}`)} />
              ))}
            </ScrollView>

            <View style={s.sectionHead}>
              <Text style={s.h2}>{t('last_posts')}</Text>
              <Pressable onPress={() => router.push('/post/new')}>
                <Text style={s.more}>{t('new_post')} +</Text>
              </Pressable>
            </View>

            {(feed.data?.length ?? 0) === 0 ? (
              <EmptyState text={t('no_posts')} />
            ) : (
              (feed.data ?? []).map((p: any) => {
                const img = (p.media ?? []).find((m: any) => m.kind === 'image');
                return (
                  <View key={p.id} style={s.post}>
                    <View style={s.postHead}>
                      <Avatar uri={p.author?.avatar_url} name={p.author?.display_name} size={32} />
                      <Text style={s.postAuthor} numberOfLines={1}>
                        {p.author?.display_name} {p.author?.is_verified ? '✔' : ''}
                      </Text>
                    </View>
                    {p.body ? <Text style={s.postBody}>{p.body}</Text> : null}
                    {img ? <View style={s.postImg}><Text style={s.postImgGlyph}>❖</Text></View> : null}
                    <Text style={s.postMeta}>♥ {p.likes_count} · ◌ {p.comments_count}</Text>
                  </View>
                );
              })
            )}

            <View style={s.sectionHead}>
              <Text style={s.h2}>{t('founding_team')}</Text>
            </View>
            <Pressable style={s.team} onPress={() => router.push('/founders')}>
              <Text style={s.teamTxt}>رنا · كاتبة ومؤسِّسة · READ PROFILE →</Text>
            </Pressable>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: palaceSafe() },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', paddingHorizontal: 20, paddingBottom: 14, gap: 8 },
  hiya: { color: palette.muted, fontSize: 11, letterSpacing: 1, marginBottom: 2 },
  brand: { color: palette.text, fontSize: 26, letterSpacing: 6, fontWeight: '600' },
  bell: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: palette.line, alignItems: 'center', justifyContent: 'center' },
  storyRow: { paddingHorizontal: 18, gap: 12, paddingBottom: 16, alignItems: 'flex-start' },
  story: { alignItems: 'center', width: 66 },
  storyRing: { width: 62, height: 62, borderRadius: 31, borderWidth: 1.6, borderColor: palette.gold + '99', alignItems: 'center', justifyContent: 'center' },
  storyInner: { width: 54, height: 54, borderRadius: 27, backgroundColor: palette.panel2, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  storyName: { color: palette.muted, fontSize: 10, marginTop: 6, textAlign: 'center' },
  hero: { marginHorizontal: 18, borderRadius: radius.lg, backgroundColor: palette.panel, borderWidth: 1, borderColor: palette.line, padding: 20, overflow: 'hidden' },
  heroShade: { position: 'absolute', top: -40, right: -40, width: 180, height: 180, borderRadius: 90, backgroundColor: palette.gold + '14' },
  heroKicker: { color: palette.gold, fontSize: 10, letterSpacing: 3, marginBottom: 8 },
  heroTitle: { color: palette.text, fontSize: 25, fontWeight: '700', lineHeight: 31 },
  heroAuthor: { color: palette.goldSoft, fontSize: 12, marginTop: 6 },
  heroSyn: { color: palette.muted, fontSize: 12, lineHeight: 19, marginTop: 10 },
  heroBtn: { alignSelf: 'flex-start', backgroundColor: palette.gold, borderRadius: 10, paddingHorizontal: 18, paddingVertical: 10, marginTop: 16 },
  heroBtnTxt: { color: '#1A1405', fontWeight: '700', fontSize: 13 },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginTop: 26, marginBottom: 12 },
  h2: { color: palette.text, fontSize: 17, fontWeight: '600', fontFamily: 'CormorantGaramond_600SemiBold' },
  more: { color: palette.goldSoft, fontSize: 11 },
  card: { width: 124, flexGrow: 0 },
  cover: { height: 176, borderRadius: radius.sm, backgroundColor: palette.panel2, borderWidth: 1, borderColor: palette.line, padding: 12, justifyContent: 'space-between' },
  coverGlyph: { color: palette.gold + 'aa', fontSize: 14 },
  coverTitle: { color: palette.text, fontSize: 13, fontWeight: '700', lineHeight: 17 },
  coverFoot: { borderTopWidth: 1, borderTopColor: palette.line, paddingTop: 6 },
  coverAuthor: { color: palette.muted, fontSize: 9 },
  cardTitle: { color: palette.text, fontSize: 12, marginTop: 8, fontWeight: '600' },
  cardMeta: { color: palette.muted, fontSize: 10, marginTop: 3 },
  post: { marginHorizontal: 18, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: palette.line },
  postHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  postAuthor: { color: palette.goldSoft, fontSize: 12, fontWeight: '600' },
  postBody: { color: palette.text, fontSize: 14, lineHeight: 21 },
  postImg: { height: 170, borderRadius: radius.sm, backgroundColor: palette.panel2, borderWidth: 1, borderColor: palette.line, alignItems: 'center', justifyContent: 'center', marginTop: 10 },
  postImgGlyph: { color: palette.gold + '77', fontSize: 22 },
  postMeta: { color: palette.muted, fontSize: 10, marginTop: 10 },
  team: { marginHorizontal: 18, borderRadius: radius.md, borderWidth: 1, borderColor: palette.line, padding: 16, backgroundColor: palette.panel },
  teamTxt: { color: palette.goldSoft, fontSize: 12 },
});

function palaceSafe() {
  return palette.ink;
}
