import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../src/lib/supabase';
import { useI18n } from '../../src/lib/i18n';
import { Field, Btn, Label } from '../../src/components/ui';
import { palette, radius } from '../../src/lib/theme';

export default function SignIn() {
  const { t, lang, setLang } = useI18n();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function submit() {
    setBusy(true);
    setErr('');
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) setErr(error.message);
    setBusy(false);
  }

  return (
    <SafeAreaView style={s.wrap}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={s.body} keyboardShouldPersistTaps="handled">
          <View style={s.mark}>
            <Text style={s.glyph}>س</Text>
          </View>
          <Text style={s.brand}>SARAD</Text>
          <Text style={s.tag}>{t('tagline')}</Text>

          <View style={s.langRow}>
            {(['ar', 'fr', 'en'] as const).map((l) => (
              <Pressable key={l} onPress={() => setLang(l)} style={[s.lang, lang === l && s.langOn]}>
                <Text style={[s.langTxt, lang === l && { color: '#1A1405', fontWeight: '700' }]}>
                  {l.toUpperCase()}
                </Text>
              </Pressable>
            ))}
          </View>

          {err ? <Text style={s.err}>{err}</Text> : null}

          <Field label={t('email')} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" placeholder="you@sarad.app" />
          <Field label={t('password')} value={password} onChangeText={setPassword} secureTextEntry placeholder="••••••••" />

          <Btn title={t('sign_in')} onPress={submit} loading={busy} disabled={!email || !password} />

          <Pressable onPress={() => router.push('/(auth)/forgot')} style={{ marginTop: 14, alignSelf: 'center' }}>
            <Text style={s.link}>{t('forgot')}</Text>
          </Pressable>

          <View style={s.divider}><View style={s.hr} /><Text style={s.or}>OR</Text><View style={s.hr} /></View>

          <Btn title={t('sign_up')} variant="ghost" onPress={() => router.push('/(auth)/sign-up')} />

          <Text style={s.legal}>
            Secure sessions · email verification · OTP recovery · device management
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: palette.ink },
  body: { padding: 26, paddingTop: 48, flexGrow: 1, justifyContent: 'center' },
  mark: { width: 74, height: 74, borderRadius: 37, borderWidth: 1.5, borderColor: palette.gold + '88', alignItems: 'center', justifyContent: 'center', alignSelf: 'center' },
  glyph: { color: palette.goldSoft, fontSize: 34 },
  brand: { color: palette.text, fontSize: 26, letterSpacing: 8, textAlign: 'center', marginTop: 16, fontWeight: '600' },
  tag: { color: palette.muted, textAlign: 'center', marginTop: 8, marginBottom: 22, fontSize: 12, letterSpacing: 1 },
  langRow: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 22 },
  lang: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: radius.sm, borderWidth: 1, borderColor: palette.line },
  langOn: { backgroundColor: palette.gold, borderColor: 'transparent' },
  langTxt: { color: palette.muted, fontSize: 12, fontWeight: '600' },
  err: { color: palette.bad, marginBottom: 14, textAlign: 'center', fontSize: 13 },
  link: { color: palette.goldSoft, fontSize: 13 },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 20 },
  hr: { flex: 1, height: 1, backgroundColor: palette.line },
  or: { color: palette.muted, fontSize: 10, letterSpacing: 2 },
  legal: { color: palette.muted, fontSize: 10, textAlign: 'center', marginTop: 24, lineHeight: 16 },
});
