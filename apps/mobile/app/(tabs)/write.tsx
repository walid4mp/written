import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { palette } from '../../src/lib/theme';

export default function WriteTab() {
  return (
    <View style={s.wrap}>
      <Text style={s.txt}>Opening the editor…</Text>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: palette.ink, alignItems: 'center', justifyContent: 'center' },
  txt: { color: palette.muted },
});
