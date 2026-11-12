import React from 'react';
import { View, Text, FlatList, StyleSheet, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { listNotifications, markAllRead } from '../src/lib/api';
import { useAuth } from '../src/lib/auth';
import { useI18n } from '../src/lib/i18n';
import { palette } from '../src/lib/theme';
import { Loader, EmptyState, Btn } from '../src/components/ui';

const ICON: Record<string, string> = {
  new_follower: '☺', friend_request: '⚭', friend_accepted: '✓', like: '♥', comment: '✎', reply: '↩',
  new_message: '✉', story_view: '◉', new_chapter: '❏', work_approved: '✓', work_rejected: '⚑',
  payment_success: '◊', payment_failed: '⚠', subscription_expiring: '⏳', verification_approved: '★',
  verification_rejected: '⚑', admin_announcement: '◈', group_invite: '⚭', mention: '@',
};

export default function Notifications() {
  const { t } = useI18n();
  const router = useRouter();
  const me = useAuth((s) => s.me);
  const q = useQuery({
    queryKey: ['notifications', me?.id],
    queryFn: () => listNotifications(me!.id),
    enabled: !!me?.id,
  });

  if (!me) return <EmptyState text={t('empty')} />;

  return (
    <View style={s.wrap}>
      <View style={s.head}>
        <Text style={s.count}>{q.data?.filter((n: any) => !n.read_at).length ?? 0} unread</Text>
        <Btn title="Mark all read" variant="ghost" onPress={() => markAllRead(me.id).then(() => q.refetch())} />
      </View>
      {q.isLoading ? <Loader text={t('loading')} /> : (q.data?.length ?? 0) === 0 ? <EmptyState text={t('empty')} /> : (
        <FlatList
          data={q.data}
          keyExtractor={(n: any) => n.id}
          contentContainerStyle={{ padding: 16, gap: 10 }}
          renderItem={({ item }: any) => (
            <Pressable
              style={[s.row, !item.read_at && s.unread]}
              onPress={() => {
                if (item.target_type === 'work' && item.target_id) router.push(`/work/${item.target_id}`);
                else if (item.target_type === 'user' && item.target_id) router.push(`/profile/${item.target_id}`);
              }}
            >
              <Text style={s.icon}>{ICON[item.kind] ?? '•'}</Text>
              <View style={{ flex: 1 }}>
                <Text style={s.title}>{item.title || item.kind.replace(/_/g, ' ')}</Text>
                {item.body ? <Text style={s.body} numberOfLines={2}>{item.body}</Text> : null}
              </View>
              {!item.read_at && <View style={s.dot} />}
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: palette.ink },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10 },
  count: { color: palette.muted, fontSize: 11 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 12, backgroundColor: palette.panel, borderWidth: 1, borderColor: palette.line },
  unread: { borderColor: palette.gold + '55' },
  icon: { color: palette.goldSoft, fontSize: 15, width: 20, textAlign: 'center' },
  title: { color: palette.text, fontSize: 13, fontWeight: '600' },
  body: { color: palette.muted, fontSize: 11, marginTop: 3, lineHeight: 16 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: palette.gold },
});
