import React, { useState } from 'react';
import { View, Text, TextInput, FlatList, StyleSheet, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../src/lib/supabase';
import { palette } from '../src/lib/theme';
import { EmptyState, Badge } from '../src/components/ui';

/** People search: username / display-name trigram search (indexed). */
export default function SearchPeople() {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [rows, setRows] = useState<any[]>([]);
  const [searched, setSearched] = useState(false);

  async function run() {
    const term = q.trim();
    if (!term) return;
    const { data } = await supabase
      .from('profiles')
      .select('id,username,display_name,avatar_url,account_type,is_verified,followers_count')
      .or(`username.ilike.%${term}%,display_name.ilike.%${term}%`)
      .is('deleted_at', null)
      .limit(30);
    setRows(data ?? []);
    setSearched(true);
  }

  return (
    <View style={s.wrap}>
      <View style={s.box}>
        <TextInput
          value={q}
          onChangeText={setQ}
          onSubmitEditing={run}
          placeholder="Search people…"
          placeholderTextColor={palette.muted}
          style={s.input}
          returnKeyType="search"
        />
      </View>
      {searched && rows.length === 0 ? <EmptyState text="No people matched." /> : (
        <FlatList
          data={rows}
          keyExtractor={(r) => r.id}
          contentContainerStyle={{ padding: 16, gap: 8 }}
          renderItem={({ item }) => (
            <Pressable style={s.row} onPress={() => router.push(`/profile/${item.id}`)}>
              <View style={s.av}><Text style={{ color: palette.goldSoft }}>{item.display_name?.slice(0, 1)}</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={s.name}>{item.display_name} {item.is_verified ? '✓' : ''}</Text>
                <Text style={s.meta}>@{item.username} · {item.followers_count} followers</Text>
              </View>
              <Badge text={item.account_type.toUpperCase()} />
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: palette.ink },
  box: { padding: 14 },
  input: { backgroundColor: '#0F0F12', borderWidth: 1, borderColor: palette.line, borderRadius: 10, color: palette.text, paddingHorizontal: 12, paddingVertical: 11 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: palette.line, backgroundColor: palette.panel },
  av: { width: 40, height: 40, borderRadius: 20, backgroundColor: palette.panel2, alignItems: 'center', justifyContent: 'center' },
  name: { color: palette.text, fontSize: 13, fontWeight: '600' },
  meta: { color: palette.muted, fontSize: 10, marginTop: 3 },
});
