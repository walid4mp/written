import React, { useCallback, useRef, useState } from 'react';
import { View, Text, FlatList, StyleSheet, Pressable, Dimensions, ActivityIndicator, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Video, ResizeMode, Audio } from 'expo-av';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { listReels, registerReelView, toggleLike, toggleSaveItem, toggleFollow, reportContent } from '../src/lib/api';
import { useAuth } from '../src/lib/auth';
import { useI18n } from '../src/lib/i18n';
import { palette } from '../src/lib/theme';
import { Loader, EmptyState, ErrorState, Avatar, Btn } from '../src/components/ui';

const { height: SCREEN_H, width: SCREEN_W } = Dimensions.get('window');

export default function Reels() {
  const { t } = useI18n();
  const router = useRouter();
  const me = useAuth((s) => s.me);
  const qc = useQueryClient();
  const insets = useSafeAreaInsets();
  const [muted, setMuted] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [views, setViews] = useState<Record<string, number>>({});
  const [liked, setLiked] = useState<Record<string, boolean>>({});

  const q = useQuery({ queryKey: ['reels'], queryFn: () => listReels(20) });

  const onViewable = useRef(({ viewableItems }: any) => {
    const first = viewableItems?.[0]?.item;
    if (!first) return;
    setActiveId(first.id);
    if (!views[first.id]) {
      registerReelView(first.id).then((count) => {
        if (typeof count === 'number') setViews((v) => ({ ...v, [first.id]: count }));
      });
    }
  }).current;

  const like = useCallback(
    async (item: any) => {
      if (!me) return Alert.alert(t('sign_in'));
      const next = await toggleLike('post', item.post_id ?? item.id, me.id);
      setLiked((l) => ({ ...l, [item.id]: next }));
    },
    [me, t],
  );

  if (q.isLoading) return <Loader text={t('loading')} />;
  if (q.error) return <ErrorState text={(q.error as Error).message} onRetry={() => q.refetch()} />;
  if (!q.data?.length) {
    return (
      <View style={s.center}>
        <EmptyState
          text={t('no_reels')}
          action={<Btn title={t('create_reel')} variant="soft" onPress={() => router.push('/post/new')} />}
        />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <FlatList
        data={q.data as any[]}
        keyExtractor={(x: any) => x.id}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        snapToInterval={SCREEN_H}
        decelerationRate="fast"
        onViewableItemsChanged={onViewable}
        viewabilityConfig={{ itemVisiblePercentThreshold: 70 }}
        renderItem={({ item }) => (
          <View style={{ height: SCREEN_H, width: SCREEN_W }}>
            <Video
              source={{ uri: item.url }}
              style={StyleSheet.absoluteFill}
              resizeMode={ResizeMode.COVER}
              isLooping
              shouldPlay={activeId === item.id}
              isMuted={muted}
              useNativeControls={false}
              posterSource={{ uri: item.url }}
            />

            <Pressable style={StyleSheet.absoluteFill} onPress={() => setMuted((m) => !m)}>
              <View style={s.mutePill}>
                <Text style={s.muteTxt}>{muted ? '🔇' : '🔊'}</Text>
              </View>
            </Pressable>

            <View style={[s.overlay, { paddingBottom: insets.bottom + 96 }]}>
              <Pressable style={s.authorRow} onPress={() => router.push(`/profile/${item.owner_id}`)}>
                <Avatar uri={item.owner?.avatar_url} name={item.owner?.display_name} size={38} />
                <View style={{ flex: 1 }}>
                  <Text style={s.author} numberOfLines={1}>
                    {item.owner?.display_name} {item.owner?.is_verified ? '✔' : ''}
                  </Text>
                  <Text style={s.handle} numberOfLines={1}>@{item.owner?.username}</Text>
                </View>
                {me && me.id !== item.owner_id ? (
                  <Pressable
                    style={s.followBtn}
                    onPress={async () => { await toggleFollow(item.owner_id, me.id); Alert.alert(t('success'), t('following')); }}
                  >
                    <Text style={s.followTxt}>{t('follow')}</Text>
                  </Pressable>
                ) : null}
              </Pressable>

              <View style={s.actions}>
                <Action glyph="♥" label={String(views[item.id] ?? item.views_count ?? 0)} onPress={() => like(item)} tone={liked[item.id] ? palette.gold : '#fff'} />
                <Action glyph="◌" label={t('save')} onPress={async () => { if (me) await toggleSaveItem('post', item.post_id ?? item.id, me.id); }} />
                <Action
                  glyph="⚑"
                  label={t('report')}
                  onPress={async () => {
                    if (!me) return;
                    await reportContent({ reporterId: me.id, targetType: 'post', targetId: item.post_id ?? item.id, reason: 'reel' });
                    Alert.alert(t('success'), t('reported'));
                  }}
                />
                {item.post_id ? (
                  <Action glyph="↗" label={t('open_post')} onPress={() => router.push('/profile/' + item.owner_id)} />
                ) : null}
              </View>
            </View>
          </View>
        )}
      />
      <Pressable style={[s.close, { top: insets.top + 8 }]} onPress={() => router.back()}>
        <Text style={{ color: '#fff', fontSize: 18 }}>✕</Text>
      </Pressable>
    </View>
  );
}

function Action({ glyph, label, onPress, tone = '#fff' }: { glyph: string; label: string; onPress?: () => void; tone?: string }) {
  return (
    <Pressable style={s.action} onPress={onPress} hitSlop={8}>
      <Text style={[s.actionGlyph, { color: tone }]}>{glyph}</Text>
      <Text style={s.actionLabel} numberOfLines={1}>{label}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  center: { flex: 1, backgroundColor: palette.ink, justifyContent: 'center' },
  overlay: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 16, gap: 14 },
  authorRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  author: { color: '#fff', fontWeight: '700', fontSize: 14 },
  handle: { color: '#ffffffaa', fontSize: 11, marginTop: 2 },
  followBtn: { borderWidth: 1, borderColor: palette.gold, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 6 },
  followTxt: { color: palette.goldSoft, fontSize: 11, fontWeight: '700' },
  actions: { flexDirection: 'row', gap: 20, alignItems: 'center' },
  action: { alignItems: 'center', gap: 4 },
  actionGlyph: { fontSize: 20 },
  actionLabel: { color: '#ffffffcc', fontSize: 9 },
  mutePill: {
    position: 'absolute', right: 16, top: '45%', width: 42, height: 42, borderRadius: 21,
    backgroundColor: '#00000066', alignItems: 'center', justifyContent: 'center',
  },
  muteTxt: { fontSize: 16 },
  close: { position: 'absolute', left: 16, width: 36, height: 36, borderRadius: 18, backgroundColor: '#00000088', alignItems: 'center', justifyContent: 'center' },
});
