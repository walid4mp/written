import React from 'react';
import { View, Text, FlatList, StyleSheet, Pressable, Image, Share, Dimensions } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../src/lib/supabase';
import { toggleFollow, toggleLike, ensureDirectConversation } from '../../src/lib/api';
import { useAuth } from '../../src/lib/auth';
import { useI18n } from '../../src/lib/i18n';
import { palette, radius } from '../../src/lib/theme';
import { Loader, EmptyState, Badge, Btn } from '../../src/components/ui';

const { width } = Dimensions.get('window');

export default function PublicProfile() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const me = useAuth((s) => s.me);
  const router = useRouter();
  const { t } = useI18n();

  const profile = useQuery({
    queryKey: ['profile', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id,username,display_name,avatar_url,bio,account_type,is_verified,is_vip,highest_badge,followers_count,following_count,works_count,created_at')
        .eq('id', id!)
        .single();
      if (error) throw new Error(error.message);
      return data;
    },
  });

  const works = useQuery({
    queryKey: ['author-works', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('works')
        .select('id,title,kind,chapters_count,reads_count,rating_avg,status')
        .eq('author_id', id!)
        .eq('status', 'published')
        .order('published_at', { ascending: false });
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  const posts = useQuery({
    queryKey: ['author-posts', id],
    queryFn: async () => {
      const { data } = await supabase
        .from('posts')
        .select('id,body,likes_count,created_at')
        .eq('author_id', id!)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(20);
      return data ?? [];
    },
  });

  const following = useQuery({
    queryKey: ['following', id, me?.id],
    queryFn: async () => {
      const { data } = await supabase.from('follows').select('following_id').eq('follower_id', me!.id).eq('following_id', id!).maybeSingle();
      return !!data;
    },
    enabled: !!me?.id,
  });

  if (profile.isLoading) return <Loader text={t('loading')} />;
  if (!profile.data) return <EmptyState text={t('empty')} />;
  const p = profile.data;

  async function message() {
    if (!me) return;
    const cid = await ensureDirectConversation(me.id, p.id);
    router.push(`/messages/${cid}`);
  }

  return (
    <FlatList
      style={s.wrap}
      data={works.data ?? []}
      keyExtractor={(w: any) => w.id}
      contentContainerStyle={{ paddingBottom: 40 }}
      ListHeaderComponent={
        <>
          <View style={s.cover}><View style={s.glow} /></View>
          <View style={{ paddingHorizontal: 18, marginTop: -32 }}>
            <View style={s.avatar}>
              {p.avatar_url ? <Image source={{ uri: p.avatar_url }} style={s.avatarImg} /> : <Text style={s.avGlyph}>{p.display_name.slice(0, 1)}</Text>}
              {p.is_verified && <View style={s.check}><Text style={{ color: '#1A1405', fontSize: 10, fontWeight: '900' }}>✓</Text></View>}
            </View>
            <Text style={s.name}>{p.display_name}</Text>
            <Text style={s.handle}>@{p.username}</Text>
            <View style={{ flexDirection: 'row', gap: 6, marginTop: 8 }}>
              <Badge text={p.account_type.toUpperCase()} />
              {p.is_vip && <Badge text="VIP" />}
              {p.is_verified && <Badge text={p.highest_badge.toUpperCase()} tone="ok" />}
            </View>
            {p.bio ? <Text style={s.bio}>{p.bio}</Text> : null}
            <View style={s.stats}>
              <Text style={s.stat}><Text style={s.statN}>{p.works_count}</Text> {t('works')}</Text>
              <Text style={s.stat}><Text style={s.statN}>{p.followers_count}</Text> {t('followers')}</Text>
              <Text style={s.stat}><Text style={s.statN}>{p.following_count}</Text> {t('following')}</Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
              <Btn
                title={following.data ? t('unfollow') : t('follow')}
                style={{ flex: 1 }}
                onPress={() => me && toggleFollow(p.id, me.id).then(() => { following.refetch(); profile.refetch(); })}
              />
              <Btn title="Message" variant="ghost" style={{ flex: 1 }} onPress={message} />
            </View>
          </View>

          <Text style={s.section}>Published works</Text>
        </>
      }
      renderItem={({ item }: any) => (
        <Pressable style={s.row} onPress={() => router.push(`/work/${item.id}`)}>
          <View style={{ flex: 1 }}>
            <Text style={s.wTitle}>{item.title}</Text>
            <Text style={s.wMeta}>{item.kind} · {item.chapters_count} ch. · ★ {Number(item.rating_avg).toFixed(1)}</Text>
          </View>
          <Text style={{ color: palette.goldSoft }}>→</Text>
        </Pressable>
      )}
      ListEmptyComponent={<EmptyState text="No published works yet." />}
      ListFooterComponent={
        <>
          <Text style={s.section}>Recent posts</Text>
          {(posts.data ?? []).length === 0 ? <EmptyState text="No posts yet." /> : (
            (posts.data ?? []).map((post: any) => (
              <View key={post.id} style={s.post}>
                <Text style={s.postBody}>{post.body}</Text>
                <Pressable onPress={() => me && toggleLike('post', post.id, me.id).then(() => posts.refetch())}>
                  <Text style={s.postLike}>♥ {post.likes_count}</Text>
                </Pressable>
              </View>
            ))
          )}
        </>
      }
    />
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: palette.ink },
  cover: { height: 120, backgroundColor: '#131118', overflow: 'hidden' },
  glow: { position: 'absolute', right: -60, top: -80, width: 240, height: 240, borderRadius: 120, backgroundColor: palette.gold + '18' },
  avatar: { width: 76, height: 76, borderRadius: 38, backgroundColor: palette.panel2, borderWidth: 2, borderColor: palette.gold, alignItems: 'center', justifyContent: 'center' },
  avatarImg: { width: 72, height: 72, borderRadius: 36 },
  avGlyph: { color: palette.goldSoft, fontSize: 26, fontWeight: '700' },
  check: { position: 'absolute', bottom: -2, right: -2, width: 21, height: 21, borderRadius: 11, backgroundColor: palette.gold, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: palette.ink },
  name: { color: palette.text, fontSize: 20, fontWeight: '700', marginTop: 10 },
  handle: { color: palette.muted, fontSize: 12, marginTop: 2 },
  bio: { color: palette.muted, fontSize: 12, lineHeight: 19, marginTop: 10 },
  stats: { flexDirection: 'row', gap: 18, marginTop: 14, paddingVertical: 10, borderTopWidth: 1, borderBottomWidth: 1, borderColor: palette.line },
  stat: { color: palette.muted, fontSize: 11 },
  statN: { color: palette.text, fontWeight: '700', fontSize: 14 },
  section: { color: palette.muted, fontSize: 10, letterSpacing: 2, marginHorizontal: 18, marginTop: 22, marginBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 18, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: palette.line },
  wTitle: { color: palette.text, fontSize: 14, fontWeight: '600' },
  wMeta: { color: palette.muted, fontSize: 10, marginTop: 3 },
  post: { marginHorizontal: 18, padding: 14, borderRadius: radius.md, backgroundColor: palette.panel, borderWidth: 1, borderColor: palette.line, marginBottom: 8 },
  postBody: { color: palette.text, fontSize: 13, lineHeight: 20 },
  postLike: { color: palette.muted, fontSize: 11, marginTop: 8 },
});
