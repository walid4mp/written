import React from 'react';
import {
  Text, TextInput, View, ActivityIndicator, Pressable, StyleSheet, ScrollView, Image,
} from 'react-native';
import { palette, radius } from '../lib/theme';

/* ─────────────────────────── surfaces ─────────────────────────── */

export function Card({ children, style }: { children: React.ReactNode; style?: object }) {
  return <View style={[s.card, style]}>{children}</View>;
}

export function Label({ children }: { children: string }) {
  return <Text style={s.label}>{children}</Text>;
}

export function Divider({ style }: { style?: object }) {
  return <View style={[s.divider, style]} />;
}

export function Avatar({ uri, name, size = 40 }: { uri?: string | null; name?: string; size?: number }) {
  const r = size / 2;
  return (
    <View style={{ width: size, height: size, borderRadius: r, backgroundColor: palette.panel2, borderWidth: 1, borderColor: palette.line, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
      {uri ? (
        <Image source={{ uri }} style={{ width: size, height: size }} />
      ) : (
        <Text style={{ color: palette.goldSoft, fontSize: size * 0.4, fontWeight: '700' }}>{(name ?? '?').slice(0, 1)}</Text>
      )}
    </View>
  );
}

/* ─────────────────────────── inputs ─────────────────────────── */

export function Field(props: React.ComponentProps<typeof TextInput> & { label?: string }) {
  return (
    <View style={{ marginBottom: 14 }}>
      {props.label ? <Label>{props.label}</Label> : null}
      <TextInput
        {...props}
        placeholderTextColor={palette.muted}
        style={[s.input, props.style]}
      />
    </View>
  );
}

/* ─────────────────────────── buttons ─────────────────────────── */

export function Btn({
  title, onPress, variant = 'primary', loading, disabled, style, icon,
}: {
  title: string;
  onPress?: () => void;
  variant?: 'primary' | 'ghost' | 'danger' | 'soft';
  loading?: boolean;
  disabled?: boolean;
  style?: object;
  icon?: string;
}) {
  const off = disabled || loading;
  return (
    <Pressable
      onPress={off ? undefined : onPress}
      accessibilityRole="button"
      style={({ pressed }) => [
        s.btn,
        variant === 'primary' && s.btnPrimary,
        variant === 'danger' && s.btnDanger,
        variant === 'ghost' && s.btnGhost,
        variant === 'soft' && s.btnSoft,
        off && { opacity: 0.5 },
        pressed && !off && { opacity: 0.85 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? '#1A1405' : palette.text} />
      ) : (
        <>
          {icon ? <Text style={[s.btnIcon, variant === 'primary' && { color: '#1A1405' }]}>{icon}</Text> : null}
          <Text style={[s.btnText, variant === 'primary' && { color: '#1A1405' }]} numberOfLines={1}>{title}</Text>
        </>
      )}
    </Pressable>
  );
}

/**
 * ChipRow — horizontal filter/tab strip.
 *
 * The vertical-stretch bug ("pills taller than the screen") came from RN's
 * ScrollView base style `flexGrow: 1`: the scroll view grew to fill the column
 * and its row content container defaulted to `alignItems: 'stretch'`, so every
 * chip was stretched to the container height. We pin the scroll view with
 * flexGrow/flexShrink = 0 and centre the row on the cross axis.
 */
export function ChipRow({
  children, style, contentStyle,
}: { children: React.ReactNode; style?: object; contentStyle?: object }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={[s.chipScroll, style]}
      contentContainerStyle={[s.chipRow, contentStyle]}
    >
      {children}
    </ScrollView>
  );
}

export function Chip({
  label, active, onPress, count,
}: { label: string; active?: boolean; onPress?: () => void; count?: number }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: !!active }}
      style={({ pressed }) => [s.chip, active && s.chipOn, pressed && { opacity: 0.8 }]}
    >
      <Text style={[s.chipTxt, active && s.chipTxtOn]} numberOfLines={1}>
        {label}{typeof count === 'number' ? ` ${count}` : ''}
      </Text>
    </Pressable>
  );
}

/* ─────────────────────────── states ─────────────────────────── */

export function Loader({ text }: { text?: string }) {
  return (
    <View style={{ padding: 32, alignItems: 'center', gap: 10 }}>
      <ActivityIndicator color={palette.gold} />
      {text ? <Text style={{ color: palette.muted }}>{text}</Text> : null}
    </View>
  );
}

export function EmptyState({ text, action }: { text: string; action?: React.ReactNode }) {
  return (
    <View style={s.empty}>
      <Text style={s.emptyGlyph}>❖</Text>
      <Text style={{ color: palette.muted, textAlign: 'center', lineHeight: 20 }}>{text}</Text>
      {action ? <View style={{ marginTop: 14 }}>{action}</View> : null}
    </View>
  );
}

export function ErrorState({ text, onRetry, retryLabel = 'Retry' }: { text: string; onRetry?: () => void; retryLabel?: string }) {
  return (
    <View style={s.empty}>
      <Text style={[s.emptyGlyph, { color: palette.bad }]}>!</Text>
      <Text style={{ color: palette.muted, textAlign: 'center', lineHeight: 20 }}>{text}</Text>
      {onRetry ? <Btn title={retryLabel} variant="ghost" onPress={onRetry} style={{ marginTop: 12 }} /> : null}
    </View>
  );
}

export function Badge({ text, tone = 'gold' }: { text: string; tone?: 'gold' | 'ok' | 'bad' | 'muted' }) {
  const color =
    tone === 'ok' ? palette.ok : tone === 'bad' ? palette.bad : tone === 'muted' ? palette.muted : palette.gold;
  return (
    <View style={[s.badge, { borderColor: color + '77' }]}>
      <Text style={{ color, fontSize: 10, fontWeight: '700' }}>{text}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: palette.panel,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.line,
    padding: 16,
  },
  divider: { height: 1, backgroundColor: palette.line },
  label: { color: palette.muted, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 },
  input: {
    backgroundColor: '#0F0F12',
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: radius.sm,
    color: palette.text,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 15,
    minHeight: 46,
  },
  btn: {
    flexGrow: 0,
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 46,
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.panel2,
  },
  btnPrimary: { backgroundColor: palette.gold, borderColor: 'transparent' },
  btnDanger: { borderColor: palette.bad + '99', backgroundColor: 'transparent' },
  btnGhost: { backgroundColor: 'transparent' },
  btnSoft: { backgroundColor: palette.gold + '18', borderColor: palette.gold + '55' },
  btnText: { color: palette.text, fontWeight: '700', fontSize: 15 },
  btnIcon: { color: palette.text, fontSize: 15 },
  chipScroll: { flexGrow: 0, flexShrink: 0, maxHeight: 58 },
  chipRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 18, paddingVertical: 12 },
  chip: {
    flexGrow: 0,
    flexShrink: 0,
    height: 34,
    justifyContent: 'center',
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: 'transparent',
  },
  chipOn: { backgroundColor: palette.gold, borderColor: 'transparent' },
  chipTxt: { color: palette.muted, fontSize: 12 },
  chipTxtOn: { color: '#1A1405', fontWeight: '700' },
  empty: { paddingVertical: 44, paddingHorizontal: 32, alignItems: 'center', gap: 10 },
  emptyGlyph: { color: palette.gold + '77', fontSize: 26 },
  badge: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, alignSelf: 'flex-start' },
});
