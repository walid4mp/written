import React from 'react';
import { ScrollView, View, Text, StyleSheet } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../src/lib/auth';
import { myEarnings } from '../src/lib/api';
import { palette, radius } from '../src/lib/theme';
import { Loader } from '../src/components/ui';

function amount(value: number) {
  return Number(value || 0).toFixed(2);
}

export default function Earnings() {
  const me = useAuth((s) => s.me);
  const query = useQuery({
    queryKey: ['creator-earnings', me?.id],
    queryFn: () => myEarnings(me!.id),
    enabled: !!me?.id,
  });
  if (query.isLoading) return <Loader text="Loading earnings…" />;
  if (query.error) return <View style={styles.wrap}><Text style={styles.error}>{(query.error as Error).message}</Text></View>;
  const data = query.data;
  return (
    <ScrollView style={styles.wrap} contentContainerStyle={{ padding: 18, paddingBottom: 50 }}>
      <Text style={styles.title}>Creator earnings</Text>
      <Text style={styles.sub}>Your net earnings after the platform fee.</Text>
      <View style={styles.cards}>
        <View style={styles.card}><Text style={styles.label}>Available</Text><Text style={styles.value}>{amount(data?.available ?? 0)}</Text></View>
        <View style={styles.card}><Text style={styles.label}>Pending</Text><Text style={styles.value}>{amount(data?.pending ?? 0)}</Text></View>
        <View style={styles.card}><Text style={styles.label}>Total earned</Text><Text style={styles.value}>{amount(data?.total ?? 0)}</Text></View>
      </View>
      <Text style={styles.section}>TRANSACTION HISTORY</Text>
      {(data?.rows ?? []).length === 0 ? (
        <View style={styles.empty}><Text style={styles.sub}>No creator earnings yet. Eligible sales will appear here.</Text></View>
      ) : (data?.rows ?? []).map((row: any, index: number) => (
        <View key={`${row.created_at}-${index}`} style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.rowTitle}>Content sale</Text>
            <Text style={styles.sub}>{new Date(row.created_at).toLocaleString()}</Text>
            <Text style={styles.sub}>Gross {amount(row.gross_amount)} · Platform fee {amount(row.platform_fee)}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.value}>{amount(row.net_amount)}</Text>
            <Text style={styles.status}>{row.status}</Text>
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: palette.ink },
  title: { color: palette.text, fontSize: 24, fontWeight: '800' },
  sub: { color: palette.muted, fontSize: 11, marginTop: 4 },
  cards: { gap: 10, marginTop: 18 },
  card: { padding: 16, borderRadius: radius.md, borderWidth: 1, borderColor: palette.line, backgroundColor: palette.panel },
  label: { color: palette.muted, fontSize: 11 },
  value: { color: palette.goldSoft, fontSize: 19, fontWeight: '800', marginTop: 5 },
  section: { color: palette.muted, fontSize: 10, letterSpacing: 2, marginTop: 26, marginBottom: 8 },
  empty: { borderWidth: 1, borderColor: palette.line, borderRadius: radius.md, padding: 16 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: palette.line },
  rowTitle: { color: palette.text, fontSize: 13, fontWeight: '700' },
  status: { color: palette.muted, fontSize: 10, marginTop: 3, textTransform: 'capitalize' },
  error: { color: palette.bad, padding: 20 },
});
