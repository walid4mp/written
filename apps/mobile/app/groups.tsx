import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, Alert } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { publicGroups, myGroups, joinGroup } from '../src/lib/api';
import { useAuth } from '../src/lib/auth';
import { useI18n } from '../src/lib/i18n';
import { palette, radius } from '../src/lib/theme';
import { Loader, EmptyState, Badge, Btn } from '../src/components/ui';

export default function Groups() {
  const { t } = useI18n();
  const me = useAuth((s) => s.me);
  const [tab, setTab] = useState<'discover' | 'mine'>('discover');

  const all = useQuery({ queryKey: ['groups'], queryFn: () => publicGroups() });
  const mine = useQuery({ queryKey: ['my-groups', me?.id], queryFn: () => myGroups(me!.id), enabled: !!me?.id });

  async function join(id: string) {
    if (!me) return;
    try {
      await joinGroup(id, me.id);
      Alert.alert('Request sent', 'The group owner will review your request.');
      mine.refetch();
    } catch (e) { Alert.alert('Failed', (e as Error).message); }
  }

  return (
    <ScrollView style={s.wrap} contentContainerStyle={{ padding: 18, paddingBottom: 50 }}>
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
        {(['discover', 'mine'] as const).map((k) => (
          <Pressable key={k} onPress={() => setTab(k)} style={[s.chip, tab === k && s.chipOn]}>
            <Text style={{ color: tab === k ? '#1A1405' : palette.muted, fontSize: 12, fontWeight: '700' }}>
              {k === 'discover' ? 'Discover' : t('groups')}
            </Text>
          </Pressable>
        ))}
      </View>

      {tab === 'discover' && (
        all.isLoading ? <Loader /> : (all.data?.length ?? 0) === 0 ? <EmptyState text={t('empty')} /> : (
          (all.data ?? []).map((g: any) => (
            <View key={g.id} style={s.card}>
              <View style={{ flex: 1 }}>
                <Text style={s.name}>{g.name}</Text>
                <Text style={s.meta}>{g.category} · {g.members_count} members</Text>
                {g.description ? <Text style={s.desc} numberOfLines={2}>{g.description}</Text> : null}
                <View style={{ flexDirection: 'row', gap: 6, marginTop: 8 }}>
                  <Badge text={g.privacy} tone={g.privacy === 'public' ? 'ok' : 'gold'} />
                </View>
              </View>
              <Btn title="Join" onPress={() => join(g.id)} style={{ paddingHorizontal: 14 }} />
            </View>
          ))
        )
      )}

      {tab === 'mine' && (
        mine.isLoading ? <Loader /> : (mine.data?.length ?? 0) === 0 ? <EmptyState text={t('empty')} /> : (
          (mine.data ?? []).map((m: any) => (
            <View key={m.group?.id} style={s.card}>
              <View style={{ flex: 1 }}>
                <Text style={s.name}>{m.group?.name}</Text>
                <Text style={s.meta}>{m.role} · {m.status}</Text>
              </View>
              <Badge text={m.status} tone={m.status === 'approved' ? 'ok' : 'gold'} />
            </View>
          ))
        )
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: palette.ink },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: palette.line },
  chipOn: { backgroundColor: palette.gold, borderColor: 'transparent' },
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: radius.md, borderWidth: 1, borderColor: palette.line, backgroundColor: palette.panel, marginBottom: 10 },
  name: { color: palette.text, fontSize: 14, fontWeight: '600' },
  meta: { color: palette.muted, fontSize: 10, marginTop: 3 },
  desc: { color: palette.muted, fontSize: 11, marginTop: 6, lineHeight: 16 },
});
