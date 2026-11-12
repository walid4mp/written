import React from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, Linking, Image } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { listFounders } from '../src/lib/api';
import { useI18n } from '../src/lib/i18n';
import { palette, radius } from '../src/lib/theme';
import { Loader, EmptyState, Badge } from '../src/components/ui';

export default function Founders() {
  const { t, lang } = useI18n();
  const q = useQuery({ queryKey: ['founders'], queryFn: listFounders });

  if (q.isLoading) return <Loader text={t('loading')} />;
  if (!q.data?.length) return <EmptyState text={t('empty')} />;

  return (
    <ScrollView style={s.wrap} contentContainerStyle={{ padding: 18, paddingBottom: 60 }}>
      <Text style={s.h1}>{t('founding_team')}</Text>
      <Text style={s.lead}>
        من يقف خلف سَراد — الكاتبة والمطوّر. الحسابات أدناه موثّقة رسمياً داخل المنصة، ولا تُمنح
        الشارات إلا عبر المراجعة الإدارية.
      </Text>

      {q.data.map((f: any) => {
        const role = lang === 'ar' && f.role_title_ar ? f.role_title_ar : lang === 'fr' && f.role_title_fr ? f.role_title_fr : f.role_title;
        const bio = lang === 'ar' && f.bio_ar ? f.bio_ar : lang === 'fr' && f.bio_fr ? f.bio_fr : f.bio;
        return (
          <View key={f.id} style={s.card}>
            <View style={s.top}>
              <View style={s.avatar}>
                {f.avatar_url ? (
                  <Image source={{ uri: f.avatar_url }} style={s.avatarImg} />
                ) : (
                  <Text style={s.avatarGlyph}>{f.full_name.slice(0, 1)}</Text>
                )}
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={s.name}>{f.full_name}</Text>
                  {f.ownership_verified ? <Text style={{ color: palette.gold }}>✓</Text> : null}
                </View>
                <Text style={s.role}>{role}</Text>
                <View style={{ flexDirection: 'row', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                  {f.is_official && <Badge text="OFFICIAL" tone="ok" />}
                  {f.is_primary_author && <Badge text="LEAD AUTHOR" />}
                  {f.ownership_verified && <Badge text="OWNERSHIP VERIFIED" tone="ok" />}
                </View>
              </View>
            </View>

            {bio ? <Text style={s.bio}>{bio}</Text> : null}

            <View style={s.links}>
              {f.instagram_url ? (
                <Pressable onPress={() => Linking.openURL(f.instagram_url)} style={s.link}>
                  <Text style={s.linkTxt}>Instagram</Text>
                </Pressable>
              ) : null}
              {f.tiktok_url ? (
                <Pressable onPress={() => Linking.openURL(f.tiktok_url)} style={s.link}>
                  <Text style={s.linkTxt}>TikTok</Text>
                </Pressable>
              ) : null}
              {f.website_url ? (
                <Pressable onPress={() => Linking.openURL(f.website_url)} style={s.link}>
                  <Text style={s.linkTxt}>Website</Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        );
      })}

      <Text style={s.legal}>
        Ownership of each linked account is proven separately (code challenge in the bio / admin
        review). Linking a URL here never grants access to that account.
      </Text>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: palette.ink },
  h1: { color: palette.text, fontSize: 24, fontWeight: '700', marginTop: 10 },
  lead: { color: palette.muted, fontSize: 12, lineHeight: 20, marginTop: 10, marginBottom: 18 },
  card: { borderRadius: radius.lg, borderWidth: 1, borderColor: palette.line, backgroundColor: palette.panel, padding: 16, marginBottom: 14 },
  top: { flexDirection: 'row', gap: 14, alignItems: 'center' },
  avatar: { width: 62, height: 62, borderRadius: 31, backgroundColor: palette.panel2, borderWidth: 1.5, borderColor: palette.gold, alignItems: 'center', justifyContent: 'center' },
  avatarImg: { width: 58, height: 58, borderRadius: 29 },
  avatarGlyph: { color: palette.goldSoft, fontSize: 24, fontWeight: '700' },
  name: { color: palette.text, fontSize: 17, fontWeight: '700' },
  role: { color: palette.goldSoft, fontSize: 11, marginTop: 3 },
  bio: { color: palette.muted, fontSize: 12, lineHeight: 20, marginTop: 14 },
  links: { flexDirection: 'row', gap: 8, marginTop: 14, flexWrap: 'wrap' },
  link: { borderWidth: 1, borderColor: palette.line, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7 },
  linkTxt: { color: palette.text, fontSize: 11 },
  legal: { color: palette.muted, fontSize: 10, lineHeight: 16, marginTop: 10 },
});
