import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, Image, ImageBackground, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../src/lib/auth';
import { useI18n } from '../../src/lib/i18n';
import { myWorks, myLibrary, subscriptionState, listFounders, listUserPosts } from '../../src/lib/api';
import { palette, radius } from '../../src/lib/theme';
import { Badge, Loader, EmptyState, ErrorState, Btn, ChipRow, Chip, Avatar } from '../../src/components/ui';

type Tab = 'posts' | 'works' | 'saved';

export default function Profile() {
  const { t, lang, setLang } = useI18n();
  const router = useRouter();
  const { me, signOut } = useAuth();
  const [tab, setTab] = useState<Tab>('posts');

  const works = useQuery({ queryKey: ['my-works', me?.id], queryFn: () => myWorks(me!.id), enabled: !!me?.id });
  const lib = useQuery({ queryKey: ['library', me?.id], queryFn: () => myLibrary(me!.id), enabled: !!me?.id });
  const sub = useQuery({ queryKey: ['sub', me?.id], queryFn: () => subscriptionState(me!.id), enabled: !!me?.id });
  const founders = useQuery({ queryKey: ['founders'], queryFn: listFounders });
  // FIX: posts were never queried for the profile — that is why nothing appeared.
  const posts = useQuery({
    queryKey: ['user-posts', me?.id],
    queryFn: () => listUserPosts(me!.id),
    enabled: !!me?.id,
  });

  if (!me) return <Loader text={t('loading')} />;

  const exemption = sub.data?.exemptions?.find((e: any) => e.kind === 'publish_fee' || e.kind === 'unlimited_publish');
  const refreshing = posts.isFetching || works.isFetching;

  return (
    <ScrollView
      style={s.wrap}
      contentContainerStyle={{ paddingBottom: 130 }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => { posts.refetch(); works.refetch(); lib.refetch(); }}
          tintColor={palette.gold}
        />
      }
    >
      <ImageBackground
        source={me.cover_url ? { uri: me.cover_url } : undefined}
        style={s.cover}
        imageStyle={{ opacity: 0.78 }}
      >
        <View style={s.coverGlow} />
      </ImageBackground>

      <View style={s.headWrap}>
        <View style={s.avatar}>
          {me.avatar_url ? (
            <Image source={{ uri: me.avatar_url }} style={s.avatarImg} />
          ) : (
            <Text style={s.avatarGlyph}>{me.display_name.slice(0, 1)}</Text>
          )}
          {me.is_verified && (
            <View style={s.check}><Text style={{ color: '#1A1405', fontSize: 10, fontWeight: '900' }}>✓</Text></View>
          )}
        </View>
        <Text style={s.name}>{me.display_name}</Text>
        <Text style={s.handle}>@{me.username}</Text>
        <View style={{ flexDirection: 'row', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
          <Badge text={me.account_type.toUpperCase()} />
          {me.is_vip && <Badge text="VIP" tone="gold" />}
          {me.is_verified && <Badge text={me.highest_badge.toUpperCase()} tone="ok" />}
        </View>
        {me.bio ? <Text style={s.bio}>{me.bio}</Text> : null}

        <View style={s.stats}>
          <Stat n={me.works_count} l={t('works')} />
          <Stat n={me.followers_count} l={t('followers')} />
          <Stat n={me.following_count} l={t('following')} />
        </View>

        <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
          <Btn title={t('edit_profile')} variant="ghost" style={{ flex: 1 }} onPress={() => router.push('/settings')} />
          <Btn title={t('settings')} variant="ghost" style={{ flex: 1 }} onPress={() => router.push('/settings')} />
        </View>

        <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
          <Btn title="Creator earnings" variant="ghost" style={{ flex: 1 }} onPress={() => router.push('/earnings')} />
        </View>
        <Pressable style={s.publishBox} onPress={() => router.push('/subscription')}>
          <Text style={s.pbTitle}>{t('subscription')}</Text>
          <Text style={s.pbBody}>
            {me.unlimited_publish
              ? `${t('unlimited')} ✓`
              : exemption
                ? `${t('exempt')} ✓`
                : sub.data?.sub
                  ? `${sub.data.sub.plan?.name_en ?? 'Active plan'} · ${sub.data.sub.status}`
                  : `${t('free_quota')}: ${Math.max(0, 3 - me.free_works_used)}`}
          </Text>
        </Pressable>
      </View>

      <ChipRow style={{ marginTop: 18 }}>
        <Chip label={`${t('posts')} ${posts.data?.length ?? 0}`} active={tab === 'posts'} onPress={() => setTab('posts')} />
        <Chip label={`${t('my_works')} ${works.data?.length ?? 0}`} active={tab === 'works'} onPress={() => setTab('works')} />
        <Chip label={t('saved')} active={tab === 'saved'} onPress={() => setTab('saved')} />
      </ChipRow>

      {tab === 'posts' ? (
        posts.isLoading ? (
          <Loader />
        ) : posts.error ? (
          <ErrorState text={(posts.error as Error).message} onRetry={() => posts.refetch()} />
        ) : (posts.data?.length ?? 0) === 0 ? (
          <EmptyState text={t('no_posts')} action={<Btn title={t('new_post')} variant="soft" onPress={() => router.push('/post/new')} />} />
        ) : (
          posts.data!.map((p) => <PostRow key={p.id} post={p} />)
        )
      ) : tab === 'works' ? (
        (works.data?.length ?? 0) === 0 ? (
          <EmptyState text={t('empty')} action={<Btn title={t('new_work')} variant="soft" onPress={() => router.push('/editor/new')} />} />
        ) : (
          works.data!.map((w: any) => (
            <Pressable
              key={w.id}
              style={s.row}
              onPress={() => router.push(w.status === 'draft' ? `/editor/${w.id}` : `/work/${w.id}`)}
            >
              <View style={{ flex: 1 }}>
                <Text style={s.rowTitle}>{w.title}</Text>
                <Text style={s.rowMeta}>{w.kind} · {w.chapters_count} {t('chapters')} · {w.reads_count} {t('reads')}</Text>
              </View>
              <Badge text={w.status} tone={w.status === 'published' ? 'ok' : 'gold'} />
            </Pressable>
          ))
        )
      ) : (lib.data?.length ?? 0) === 0 ? (
        <EmptyState text={t('empty')} />
      ) : (
        lib.data!.map((x) => (
          <Pressable key={x.work.id} style={s.row} onPress={() => router.push(`/work/${x.work.id}`)}>
            <View style={{ flex: 1 }}>
              <Text style={s.rowTitle}>{x.work.title}</Text>
              <Text style={s.rowMeta}>{x.work.author?.display_name}</Text>
            </View>
          </Pressable>
        ))
      )}

      <View style={s.founders}>
        <Text style={s.fTitle}>{t('founding_team')}</Text>
        {(founders.data ?? []).map((f: any) => (
          <Pressable key={f.id} style={s.row} onPress={() => router.push('/founders')}>
            <View style={{ flex: 1 }}>
              <Text style={s.rowTitle}>{f.full_name} {f.ownership_verified ? '✓' : ''}</Text>
              <Text style={s.rowMeta}>{lang === 'ar' && f.role_title_ar ? f.role_title_ar : f.role_title}</Text>
            </View>
            <Text style={{ color: palette.goldSoft }}>→</Text>
          </Pressable>
        ))}
      </View>

      <View style={{ paddingHorizontal: 18, marginTop: 18, gap: 8 }}>
        <Text style={s.fTitle}>LANGUAGE</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {(['ar', 'fr', 'en'] as const).map((l) => (
            <Pressable key={l} onPress={() => setLang(l)} style={[s.lang, lang === l && s.langOn]}>
              <Text style={{ color: lang === l ? '#1A1405' : palette.muted, fontSize: 12, fontWeight: '700' }}>{l.toUpperCase()}</Text>
            </Pressable>
          ))}
        </View>
        <Btn title={t('sign_out')} variant="danger" onPress={signOut} style={{ marginTop: 10 }} />
      </View>
    </ScrollView>
  );
}

function PostRow({ post }: { post: any }) {
  const media = post.media ?? [];
  const img = media.find((m: any) => m.kind === 'image');
  return (
    <View style={s.post}>
      <Text style={s.postBody}>{post.body}</Text>
      {img ? <Image source={{ uri: img.url }} style={s.postImg} /> : null}
      <Text style={s.postMeta}>
        ♥ {post.likes_count} · ◌ {post.comments_count} · {new Date(post.created_at).toLocaleDateString()}
      </Text>
    </View>
  );
}

function Stat({ n, l }: { n: number; l: string }) {
  return (
    <View style={{ alignItems: 'center', flex: 1 }}>
      <Text style={s.statN}>{n}</Text>
      <Text style={s.statL}>{l}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: palette.ink },
  cover: { height: 110, backgroundColor: '#131118', overflow: 'hidden' },
  coverGlow: { position: 'absolute', right: -50, top: -70, width: 220, height: 220, borderRadius: 110, backgroundColor: palette.gold + '18' },
  headWrap: { paddingHorizontal: 18, marginTop: -34 },
  avatar: { width: 78, height: 78, borderRadius: 39, backgroundColor: palette.panel2, borderWidth: 2, borderColor: palette.gold, alignItems: 'center', justifyContent: 'center' },
  avatarImg: { width: 74, height: 74, borderRadius: 37 },
  avatarGlyph: { color: palette.goldSoft, fontSize: 28, fontWeight: '700' },
  check: { position: 'absolute', bottom: -2, right: -2, width: 22, height: 22, borderRadius: 11, backgroundColor: palette.gold, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: palette.ink },
  name: { color: palette.text, fontSize: 21, fontWeight: '700', marginTop: 12 },
  handle: { color: palette.muted, fontSize: 12, marginTop: 3 },
  bio: { color: palette.muted, fontSize: 12, lineHeight: 19, marginTop: 10 },
  stats: { flexDirection: 'row', marginTop: 16, borderTopWidth: 1, borderBottomWidth: 1, borderColor: palette.line, paddingVertical: 12 },
  statN: { color: palette.text, fontSize: 16, fontWeight: '700' },
  statL: { color: palette.muted, fontSize: 10, marginTop: 2 },
  publishBox: { marginTop: 14, borderRadius: radius.md, borderWidth: 1, borderColor: palette.gold + '55', backgroundColor: palette.gold + '10', padding: 14 },
  pbTitle: { color: palette.goldSoft, fontSize: 11, letterSpacing: 1 },
  pbBody: { color: palette.text, fontSize: 13, marginTop: 5, fontWeight: '600' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 18, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: palette.line },
  rowTitle: { color: palette.text, fontSize: 14, fontWeight: '600' },
  rowMeta: { color: palette.muted, fontSize: 11, marginTop: 3 },
  post: { marginHorizontal: 18, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: palette.line },
  postBody: { color: palette.text, fontSize: 14, lineHeight: 21 },
  postImg: { width: '100%', height: 190, borderRadius: radius.sm, marginTop: 10, backgroundColor: palette.panel2 },
  postMeta: { color: palette.muted, fontSize: 10, marginTop: 10 },
  founders: { marginTop: 22 },
  fTitle: { color: palette.muted, fontSize: 10, letterSpacing: 2, marginHorizontal: 18, marginBottom: 6 },
  lang: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8, borderWidth: 1, borderColor: palette.line },
  langOn: { backgroundColor: palette.gold, borderColor: 'transparent' },
});
