import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../src/lib/supabase';
import { useI18n } from '../../src/lib/i18n';
import { Field, Btn } from '../../src/components/ui';
import { palette } from '../../src/lib/theme';

export default function Forgot() {
  const { t } = useI18n();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  async function send() {
    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: 'sarad://auth/reset',
    });
    setMsg(error ? error.message : 'If that address exists we sent a recovery link.');
    setBusy(false);
  }

  return (
    <SafeAreaView style={s.wrap}>
      <ScrollView contentContainerStyle={s.body}>
        <Text style={s.h1}>{t('forgot')}</Text>
        <Text style={s.sub}>We email a single-use recovery link. The same code path also issues OTP challenges.</Text>
        {msg ? <Text style={s.msg}>{msg}</Text> : null}
        <Field label={t('email')} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
        <Btn title="Send recovery link" onPress={send} loading={busy} disabled={!email} />
        <Btn title="Back" variant="ghost" onPress={() => router.back()} style={{ marginTop: 10 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: palette.ink },
  body: { padding: 24 },
  h1: { color: palette.text, fontSize: 24, fontWeight: '700', marginTop: 18 },
  sub: { color: palette.muted, fontSize: 12, marginVertical: 16, lineHeight: 18 },
  msg: { color: palette.goldSoft, marginBottom: 14, fontSize: 13 },
});
