import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, KeyboardAvoidingView, Platform, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../src/lib/supabase';
import { useI18n } from '../../src/lib/i18n';
import { Field, Btn } from '../../src/components/ui';
import { palette } from '../../src/lib/theme';

const TYPES = [
  { key: 'reader', ar: 'قارئ', fr: 'Lecteur', en: 'Reader' },
  { key: 'author', ar: 'كاتب', fr: 'Écrivain', en: 'Author' },
  { key: 'novelist', ar: 'روائي', fr: 'Romancier', en: 'Novelist' },
  { key: 'storyteller', ar: 'راوي', fr: 'Conteur', en: 'Storyteller' },
  { key: 'poet', ar: 'شاعر', fr: 'Poète', en: 'Poet' },
] as const;

export default function SignUp() {
  const { t, lang } = useI18n();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [accountType, setAccountType] = useState<string>('reader');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const validUser = /^[a-zA-Z0-9_.]{3,30}$/.test(username);

  async function submit() {
    setBusy(true);
    setMsg(null);
    const { error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: { username, display_name: displayName || username, language: lang, account_type: accountType },
        emailRedirectTo: 'sarad://auth/callback',
      },
    });
    if (error) setMsg({ ok: false, text: error.message });
    else setMsg({ ok: true, text: 'Check your inbox to confirm your email, then sign in.' });
    setBusy(false);
  }

  return (
    <SafeAreaView style={s.wrap}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={s.body} keyboardShouldPersistTaps="handled">
          <Text style={s.h1}>{t('sign_up')}</Text>
          <Text style={s.sub}>{t('tagline')}</Text>

          {msg ? <Text style={[s.msg, { color: msg.ok ? palette.ok : palette.bad }]}>{msg.text}</Text> : null}

          <Field label={t('display_name')} value={displayName} onChangeText={setDisplayName} />
          <Field
            label={t('username')}
            value={username}
            onChangeText={(v) => setUsername(v.replace(/[^a-zA-Z0-9_.]/g, ''))}
            autoCapitalize="none"
            placeholder="ranna"
          />
          {username && !validUser ? (
            <Text style={s.hint}>3–30 chars · letters, numbers, dot, underscore</Text>
          ) : null}
          <Field label={t('email')} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
          <Field label={t('password')} value={password} onChangeText={setPassword} secureTextEntry placeholder="min 8 characters" />

          <Text style={s.label}>ACCOUNT TYPE</Text>
          <View style={s.types}>
            {TYPES.map((ty) => (
              <Pressable key={ty.key} onPress={() => setAccountType(ty.key)} style={[s.type, accountType === ty.key && s.typeOn]}>
                <Text style={[s.typeTxt, accountType === ty.key && { color: '#1A1405', fontWeight: '700' }]}>
                  {ty[lang]}
                </Text>
              </Pressable>
            ))}
          </View>

          <Btn title={t('sign_up')} onPress={submit} loading={busy} disabled={!email || password.length < 8 || !validUser} style={{ marginTop: 10 }} />
          <Btn title={t('sign_in')} variant="ghost" onPress={() => router.back()} style={{ marginTop: 10 }} />

          <Text style={s.legal}>
            Verification badges, VIP status and staff roles are granted by administrators only and
            never appear automatically on sign-up.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: palette.ink },
  body: { padding: 24, paddingBottom: 60 },
  h1: { color: palette.text, fontSize: 26, fontWeight: '700', marginTop: 20 },
  sub: { color: palette.muted, marginTop: 6, marginBottom: 22, fontSize: 12 },
  msg: { marginBottom: 14, fontSize: 13, lineHeight: 19 },
  hint: { color: palette.warn, fontSize: 11, marginTop: -8, marginBottom: 10 },
  label: { color: palette.muted, fontSize: 11, letterSpacing: 1, marginBottom: 8 },
  types: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  type: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: palette.line },
  typeOn: { backgroundColor: palette.gold, borderColor: 'transparent' },
  typeTxt: { color: palette.muted, fontSize: 12 },
  legal: { color: palette.muted, fontSize: 10, marginTop: 22, lineHeight: 16 },
});
