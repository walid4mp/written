import React, { useState } from 'react';
import { View, Text, FlatList, StyleSheet, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { myConversations } from '../../src/lib/api';
import { useAuth } from '../../src/lib/auth';
import { useI18n } from '../../src/lib/i18n';
import { palette } from '../../src/lib/theme';
import { Loader, EmptyState } from '../../src/components/ui';

export default function Messages() {
  const { t } = useI18n();
  const router = useRouter();
  const me = useAuth((s) => s.me);
  const q = useQuery({
    queryKey: ['conversations', me?.id],
    queryFn: () => myConversations(me!.id),
    enabled: !!me?.id,
    refetchInterval: 8000,
  });

  if (!me) return <EmptyState text={t('empty')} />;

  return (
    <View style={s.wrap}>
      {q.isLoading ? <Loader text={t('loading')} /> : (q.data?.length ?? 0) === 0 ? (
        <EmptyState text="No conversations yet. Open a writer's profile and tap message." />
      ) : (
        <FlatList
          data={q.data}
          keyExtractor={(m: any) => m.conversation_id}
          contentContainerStyle={{ padding: 16, gap: 10 }}
          renderItem={({ item }: any) => (
            <Pressable style={s.row} onPress={() => router.push(`/messages/${item.conversation_id}`)}>
              <View style={s.avatar}><Text style={{ color: palette.goldSoft }}>◉</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={s.title}>{item.conversation?.title ?? 'Direct message'}</Text>
                <Text style={s.meta}>{item.conversation?.kind} · {new Date(item.conversation?.last_message_at ?? Date.now()).toLocaleString()}</Text>
              </View>
              {item.is_muted ? <Text style={s.meta}>muted</Text> : null}
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: palette.ink },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: palette.line, backgroundColor: palette.panel },
  avatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: palette.panel2, alignItems: 'center', justifyContent: 'center' },
  title: { color: palette.text, fontSize: 14, fontWeight: '600' },
  meta: { color: palette.muted, fontSize: 10, marginTop: 3 },
});
