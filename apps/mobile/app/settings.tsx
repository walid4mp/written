import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, Alert, Switch, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../src/lib/supabase';
import { useAuth } from '../src/lib/auth';
import { useI18n, LANGS } from '../src/lib/i18n';
import { updateProfile, submitVerification, requestAccountType } from '../src/lib/api';
import { palette, radius } from '../src/lib/theme';
import { Btn, Field, Label } from '../src/components/ui';
import * as ImagePicker from 'expo-image-picker';
import { uploadWithProgress } from '../src/lib/upload';

export default function Settings() {
  const { t, lang, setLang } = useI18n();
  const router = useRouter();
  const { me, refreshMe, signOut } = useAuth();
  const [displayName, setDisplayName] = useState(me?.display_name ?? '');
  const [bio, setBio] = useState(me?.bio ?? '');
  const [portfolio, setPortfolio] = useState('');
  const [notify, setNotify] = useState(true);
  const [saving, setSaving] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);

  useEffect(() => {
    if (me) { setDisplayName(me.display_name); setBio(me.bio ?? ''); }
  }, [me?.id]);

  async function save() {
    if (!me) return;
    setSaving(true);
    try {
      await updateProfile(me.id, { display_name: displayName, bio });
      await refreshMe();
      Alert.alert('Saved', 'Profile updated.');
    } catch (e) { Alert.alert('Error', (e as Error).message); }
    setSaving(false);
  }

  async function changePhoto(field: 'avatar_url' | 'cover_url') {
    if (!me) return;
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission required', 'Allow SARAD to access your photo library to choose an image.');
      return;
    }
    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: field === 'avatar_url' ? [1, 1] : [16, 9],
      quality: 0.85,
    });
    if (picked.canceled || !picked.assets[0]) return;
    setPhotoBusy(true);
    try {
      const asset = picked.assets[0];
      const ext = (asset.fileName?.split('.').pop() || 'jpg').toLowerCase();
      const result = await uploadWithProgress({
        bucket: field === 'avatar_url' ? 'avatars' : 'covers',
        uri: asset.uri,
        fileName: `${field}.${ext}`,
        mime: asset.mimeType || 'image/jpeg',
        ownerId: me.id,
      });
      await updateProfile(me.id, { [field]: result.url } as any);
      await refreshMe();
      Alert.alert('Updated', field === 'avatar_url' ? 'Profile photo updated.' : 'Cover photo updated.');
    } catch (error) {
      Alert.alert('Upload failed', (error as Error).message);
    } finally {
      setPhotoBusy(false);
    }
  }

  async function requestBadge(badge: string) {
    if (!me) return;
    try {
      await submitVerification({ userId: me.id, badge, portfolioUrl: portfolio });
      Alert.alert('Request sent', 'An administrator will review your verification request.');
    } catch (e) { Alert.alert('Error', (e as Error).message); }
  }

  async function changeType(next: string) {
    if (!me) return;
    try {
      await requestAccountType(me.id, me.account_type, next, 'Requested from settings');
      Alert.alert('Request sent', 'An administrator will review your account-type request.');
    } catch (e) { Alert.alert('Error', (e as Error).message); }
  }

  async function deactivate() {
    if (!me) return;
    Alert.alert('Deactivate account', 'Your profile becomes hidden but data is kept.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Deactivate',
        style: 'destructive',
        onPress: async () => {
          await updateProfile(me.id, { is_deactivated: true });
          await signOut();
        },
      },
    ]);
  }

  async function destroy() {
    Alert.alert('Delete permanently', 'This cannot be undone. All works, messages and data are erased.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete forever',
        style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.functions.invoke('delete-account', { body: {} });
          if (error) Alert.alert('Failed', error.message);
          else await signOut();
        },
      },
    ]);
  }

  async function revokeAllSessions() {
    await supabase.auth.signOut({ scope: 'global' });
    router.replace('/(auth)/sign-in');
  }

  if (!me) return null;

  return (
    <ScrollView style={s.wrap} contentContainerStyle={{ padding: 18, paddingBottom: 60 }}>
      <Text style={s.h}>PROFILE</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        {me.avatar_url ? <Image source={{ uri: me.avatar_url }} style={{ width: 64, height: 64, borderRadius: 32 }} /> : null}
        <View style={{ flex: 1, gap: 8 }}>
          <Btn title="Change profile photo" variant="ghost" onPress={() => changePhoto('avatar_url')} loading={photoBusy} />
          <Btn title="Change profile cover" variant="ghost" onPress={() => changePhoto('cover_url')} loading={photoBusy} />
        </View>
      </View>

      <Field label={t('display_name')} value={displayName} onChangeText={setDisplayName} />
      <Field label="Bio" value={bio} onChangeText={setBio} multiline style={{ minHeight: 80 }} />
      <Btn title={t('save_draft').replace('draft', 'changes')} onPress={save} loading={saving} />

      <Text style={[s.h, { marginTop: 28 }]}>LANGUAGE</Text>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {LANGS.map((l) => (
          <Pressable key={l.code} onPress={() => setLang(l.code)} style={[s.chip, lang === l.code && s.chipOn]}>
            <Text style={{ color: lang === l.code ? '#1A1405' : palette.muted, fontSize: 12, fontWeight: '700' }}>{l.label}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={[s.h, { marginTop: 28 }]}>NOTIFICATIONS</Text>
      <View style={s.switchRow}>
        <Text style={s.swTxt}>Push notifications</Text>
        <Switch value={notify} onValueChange={setNotify} trackColor={{ true: palette.gold, false: palette.line }} />
      </View>

      <Text style={[s.h, { marginTop: 28 }]}>VERIFICATION</Text>
      <Text style={s.p}>
        Badges are granted by administrators only. Submit a request and a moderator reviews it —
        you can never assign yourself a badge.
      </Text>
      <Field label="Portfolio / published link" value={portfolio} onChangeText={setPortfolio} placeholder="https://" />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {['writer', 'novelist', 'storyteller', 'poet'].map((b) => (
          <Btn key={b} title={b} variant="ghost" onPress={() => requestBadge(b)} style={{ paddingHorizontal: 14 }} />
        ))}
      </View>

      <Text style={[s.h, { marginTop: 28 }]}>ACCOUNT TYPE</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {['author', 'novelist', 'storyteller', 'poet'].map((b) => (
          <Btn key={b} title={b} variant="ghost" onPress={() => changeType(b)} style={{ paddingHorizontal: 14 }} />
        ))}
      </View>

      <Text style={[s.h, { marginTop: 28 }]}>PRIVACY & SECURITY</Text>
      <Btn title="Sign out everywhere" variant="ghost" onPress={revokeAllSessions} />
      <Text style={[s.h, { marginTop: 22 }]}>DANGER ZONE</Text>
      <Btn title={t('deactivate')} variant="danger" onPress={deactivate} />
      <Btn title={t('delete_account')} variant="danger" onPress={destroy} style={{ marginTop: 8 }} />
      <Text style={s.p}>
        Deleting is executed by the server-side <Text style={{ color: palette.goldSoft }}>delete-account</Text> function,
        which erases your auth user and cascades every related row.
      </Text>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: palette.ink },
  h: { color: palette.muted, fontSize: 10, letterSpacing: 2, marginBottom: 12, textTransform: 'uppercase' },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: palette.line },
  chipOn: { backgroundColor: palette.gold, borderColor: 'transparent' },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: palette.line },
  swTxt: { color: palette.text, fontSize: 13 },
  p: { color: palette.muted, fontSize: 11, lineHeight: 18, marginBottom: 12 },
});
