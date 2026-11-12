import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, Linking } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../src/lib/auth';
import { useI18n } from '../src/lib/i18n';
import { subscriptionState, myPayments, canPublish } from '../src/lib/api';
import { palette, radius } from '../src/lib/theme';
import { Badge, Btn, Loader } from '../src/components/ui';

export default function Subscription() {
  const { t, lang } = useI18n();
  const me = useAuth((s) => s.me);
  const [policy, setPolicy] = useState<any>(null);

  const state = useQuery({ queryKey: ['sub', me?.id], queryFn: () => subscriptionState(me!.id), enabled: !!me?.id });
  const payments = useQuery({ queryKey: ['payments', me?.id], queryFn: () => myPayments(me!.id), enabled: !!me?.id });

  useEffect(() => { canPublish().then(setPolicy).catch(() => {}); }, []);

  if (!me) return null;

  const exemptions = state.data?.exemptions ?? [];
  const sub = state.data?.sub;

  return (
    <ScrollView style={s.wrap} contentContainerStyle={{ padding: 18, paddingBottom: 50 }}>
      <View style={s.status}>
        <Text style={s.statusLbl}>CURRENT STATUS</Text>
        <Text style={s.statusVal}>
          {me.unlimited_publish
            ? 'Unlimited publishing'
            : exemptions.length
              ? `Exempt · ${exemptions.map((e: any) => e.kind).join(', ')}`
              : sub
                ? `${sub.plan?.name_en ?? 'Plan'} · ${sub.status}`
                : policy?.allowed
                  ? `Free tier · ${policy.limit ?? 3} works`
                  : 'Payment required'}
        </Text>
        {policy ? (
          <Text style={s.statusSub}>
            {policy.allowed
              ? `Next publish: free (${policy.reason})`
              : `Next publish: ${policy.price} ${policy.currency}`}
          </Text>
        ) : null}
      </View>

      <Text style={s.h}>Plans</Text>
      {(state.data?.plans ?? []).map((p: any) => (
        <View key={p.id} style={s.plan}>
          <View style={{ flex: 1 }}>
            <Text style={s.planName}>{lang === 'ar' ? p.name_ar : lang === 'fr' ? p.name_fr : p.name_en}</Text>
            <Text style={s.planMeta}>{p.interval} · unlimited publishing</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={s.price}>{Number(p.price).toFixed(2)} {p.currency}</Text>
            <Pressable
              style={s.buy}
              onPress={() =>
                Linking.openURL(
                  `https://buy.stripe.com/test_placeholder?plan=${p.code}&uid=${me.id}`,
                )
              }
            >
              <Text style={s.buyTxt}>Choose</Text>
            </Pressable>
          </View>
        </View>
      ))}

      <Text style={[s.h, { marginTop: 24 }]}>Publish fees</Text>
      <View style={s.note}>
        <Text style={s.noteTxt}>
          Free works: {Math.max(0, (policy?.limit ?? 3) - (policy?.used ?? me.free_works_used))} remaining ·
          price per extra work {policy?.price ?? '—'} {policy?.currency ?? ''}.
        </Text>
      </View>

      <Text style={[s.h, { marginTop: 24 }]}>Payment history</Text>
      {payments.isLoading ? <Loader /> : (payments.data ?? []).length === 0 ? (
        <Text style={s.noteTxt}>No payments yet.</Text>
      ) : (
        (payments.data ?? []).map((p: any) => (
          <View key={p.id} style={s.payRow}>
            <View style={{ flex: 1 }}>
              <Text style={s.payAmt}>{Number(p.amount).toFixed(2)} {p.currency}</Text>
              <Text style={s.planMeta}>{p.purpose} · {new Date(p.created_at).toLocaleDateString()}</Text>
            </View>
            <Badge text={p.status} tone={p.status === 'succeeded' ? 'ok' : 'gold'} />
          </View>
        ))
      )}

      <Text style={s.legal}>
        Payments are confirmed only by a signature-verified webhook from the payment provider. The
        app can never mark a payment successful on its own, and refunds follow the provider policy
        configured by the administrator.
      </Text>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: palette.ink },
  status: { borderRadius: radius.md, borderWidth: 1, borderColor: palette.gold + '55', backgroundColor: palette.gold + '10', padding: 16 },
  statusLbl: { color: palette.goldSoft, fontSize: 9, letterSpacing: 2 },
  statusVal: { color: palette.text, fontSize: 17, fontWeight: '700', marginTop: 6 },
  statusSub: { color: palette.muted, fontSize: 11, marginTop: 4 },
  h: { color: palette.muted, fontSize: 10, letterSpacing: 2, marginTop: 24, marginBottom: 10, textTransform: 'uppercase' },
  plan: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: radius.md, borderWidth: 1, borderColor: palette.line, backgroundColor: palette.panel, marginBottom: 10 },
  planName: { color: palette.text, fontSize: 14, fontWeight: '600' },
  planMeta: { color: palette.muted, fontSize: 10, marginTop: 3 },
  price: { color: palette.goldSoft, fontSize: 14, fontWeight: '700' },
  buy: { marginTop: 6, backgroundColor: palette.gold, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  buyTxt: { color: '#1A1405', fontSize: 11, fontWeight: '700' },
  note: { padding: 14, borderRadius: radius.md, borderWidth: 1, borderColor: palette.line },
  noteTxt: { color: palette.muted, fontSize: 11, lineHeight: 18 },
  payRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: palette.line },
  payAmt: { color: palette.text, fontSize: 13, fontWeight: '600' },
  legal: { color: palette.muted, fontSize: 10, lineHeight: 16, marginTop: 26 },
});
