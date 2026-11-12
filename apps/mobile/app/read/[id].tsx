import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, Dimensions } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getWork, getChapters, saveProgress, registerRead, toggleLike } from '../../src/lib/api';
import { useAuth } from '../../src/lib/auth';
import { useI18n } from '../../src/lib/i18n';
import { palette } from '../../src/lib/theme';
import { Loader, EmptyState } from '../../src/components/ui';

type ReaderPrefs = { size: number; font: 'serif' | 'sans' | 'mono'; theme: 'night' | 'ink' | 'sepia' | 'paper' };

const THEMES: Record<ReaderPrefs['theme'], { bg: string; fg: string; dim: string }> = {
  night: { bg: '#000000', fg: '#E8E8EA', dim: '#7E7E88' },
  ink: { bg: '#0B0B0C', fg: '#E4E4E8', dim: '#8A8A94' },
  sepia: { bg: '#F1E7D0', fg: '#2C2318', dim: '#7A6A52' },
  paper: { bg: '#FFFFFF', fg: '#141416', dim: '#6B6B75' },
};

const FONTS = { serif: 'Georgia', sans: 'System', mono: 'Courier New' } as const;

const DEFAULT_PREFS: ReaderPrefs = { size: 17, font: 'serif', theme: 'night' };

export default function Reader() {
  const { id, chapter } = useLocalSearchParams<{ id: string; chapter?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const me = useAuth((s) => s.me);
  const { t } = useI18n();

  const [prefs, setPrefs] = useState<ReaderPrefs>(DEFAULT_PREFS);
  const [panel, setPanel] = useState(false);
  const [index, setIndex] = useState(0);
  const [bookmarked, setBookmarked] = useState(false);

  const work = useQuery({ queryKey: ['work', id], queryFn: () => getWork(id!) });
  const chapters = useQuery({ queryKey: ['chapters', id], queryFn: () => getChapters(id!), enabled: !!id });

  useEffect(() => {
    AsyncStorage.getItem('sarad.reader').then((raw) => raw && setPrefs({ ...DEFAULT_PREFS, ...JSON.parse(raw) }));
  }, []);

  useEffect(() => {
    if (!chapters.data || !chapter) return;
    const i = chapters.data.findIndex((c) => c.id === chapter);
    if (i >= 0) setIndex(i);
  }, [chapters.data, chapter]);

  useEffect(() => {
    AsyncStorage.setItem('sarad.reader', JSON.stringify(prefs)).catch(() => {});
  }, [prefs]);

  const current = chapters.data?.[index];
  const theme = THEMES[prefs.theme];
  const total = chapters.data?.length ?? 0;
  const percent = total ? Math.round(((index + 1) / total) * 100) : 0;

  useEffect(() => {
    if (!current || !me) return;
    registerRead(id!, current.id).catch(() => {});
    saveProgress({ userId: me.id, workId: id!, chapterId: current.id, percent }).catch(() => {});
  }, [current?.id, me?.id, percent]);

  const paragraphs = useMemo(
    () => (current?.content ?? '').split(/\n{1,}/).filter((p) => p.trim().length > 0),
    [current?.content],
  );

  if (work.isLoading || chapters.isLoading) return <Loader text={t('loading')} />;
  if (!work.data) return <EmptyState text={t('empty')} />;

  function go(delta: number) {
    const next = Math.min(Math.max(index + delta, 0), total - 1);
    if (chapters.data?.[next]) setIndex(next);
    if (me && chapters.data?.[next]) {
      saveProgress({ userId: me.id, workId: id!, chapterId: chapters.data[next].id, percent: Math.round(((next + 1) / total) * 100) }).catch(() => {});
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <View style={[s.top, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text style={[s.topIcon, { color: theme.fg }]}>‹</Text>
        </Pressable>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={[s.topTitle, { color: theme.fg }]} numberOfLines={1}>{current?.title || work.data.title}</Text>
          <Text style={[s.topSub, { color: theme.dim }]}>
            {index + 1} / {total} · {percent}%
          </Text>
        </View>
        <Pressable onPress={() => me && toggleLike('chapter', current!.id, me.id).then(setBookmarked)} hitSlop={12}>
          <Text style={[s.topIcon, { color: bookmarked ? palette.gold : theme.fg }]}>🔖</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 22, paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
        <Text style={[s.chKicker, { color: theme.dim }]}>{work.data.title.toUpperCase()}</Text>
        <Text style={[s.chTitle, { color: theme.fg, fontFamily: FONTS[prefs.font] }]}>
          {current?.title || `Chapter ${index + 1}`}
        </Text>
        {paragraphs.length === 0 ? (
          <Text style={[s.para, { color: theme.dim, fontSize: prefs.size, fontFamily: FONTS[prefs.font] }]}>
            This chapter has no published text yet.
          </Text>
        ) : (
          paragraphs.map((p, i) => (
            <Text
              key={i}
              style={[
                s.para,
                {
                  color: theme.fg,
                  fontSize: prefs.size,
                  lineHeight: prefs.size * 1.75,
                  fontFamily: FONTS[prefs.font],
                },
                i === 0 && { marginTop: 18 },
              ]}
            >
              {p.trim()}
            </Text>
          ))
        )}

        <View style={s.navRow}>
          <Pressable onPress={() => go(-1)} disabled={index === 0} style={[s.navBtn, { borderColor: theme.dim + '55', opacity: index === 0 ? 0.4 : 1 }]}>
            <Text style={{ color: theme.fg, fontSize: 12 }}>{'\u2039 Prev'}</Text>
          </Pressable>
          <Pressable onPress={() => go(1)} disabled={index >= total - 1} style={[s.navBtn, { borderColor: palette.gold + '88', opacity: index >= total - 1 ? 0.4 : 1 }]}>
            <Text style={{ color: palette.gold, fontSize: 12 }}>{'Next \u203a'}</Text>
          </Pressable>
        </View>
      </ScrollView>

      {panel && (
        <View style={[s.panel, { backgroundColor: theme.bg === '#FFFFFF' ? '#F4F4F6' : '#141418', paddingBottom: insets.bottom + 14 }]}>
          <Text style={s.pLabel}>SIZE</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Text style={{ color: theme.fg, fontSize: 12 }}>A</Text>
            {[15, 17, 19, 21, 24].map((sz) => (
              <Pressable key={sz} onPress={() => setPrefs({ ...prefs, size: sz })} style={[s.sizeDot, prefs.size === sz && s.sizeOn]}>
                <Text style={{ color: prefs.size === sz ? '#1A1405' : palette.muted, fontSize: 10 }}>{sz}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={[s.pLabel, { marginTop: 14 }]}>FONT</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {(['serif', 'sans', 'mono'] as const).map((f) => (
              <Pressable key={f} onPress={() => setPrefs({ ...prefs, font: f })} style={[s.fontBtn, prefs.font === f && s.fontOn]}>
                <Text style={{ color: prefs.font === f ? '#1A1405' : palette.muted, fontFamily: FONTS[f], fontSize: 14 }}>Aa</Text>
                <Text style={{ color: prefs.font === f ? '#1A1405' : palette.muted, fontSize: 9 }}>{f}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={[s.pLabel, { marginTop: 14 }]}>THEME</Text>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {(Object.keys(THEMES) as ReaderPrefs['theme'][]).map((k) => (
              <Pressable
                key={k}
                onPress={() => setPrefs({ ...prefs, theme: k })}
                style={[s.swatch, { backgroundColor: THEMES[k].bg, borderColor: prefs.theme === k ? palette.gold : palette.line }]}
              />
            ))}
          </View>
        </View>
      )}

      <View style={[s.bottom, { paddingBottom: insets.bottom + 10, backgroundColor: theme.bg }]}>
        <View style={s.progressTrack}>
          <View style={[s.progressFill, { width: `${percent}%` }]} />
        </View>
        <View style={s.tools}>
          <Tool icon="☀" label="Light" onPress={() => setPrefs({ ...prefs, theme: prefs.theme === 'night' ? 'sepia' : 'night' })} color={theme.fg} />
          <Tool icon="TT" label="Format" onPress={() => setPanel((p) => !p)} color={theme.fg} />
          <Tool icon="❏" label="Notes" onPress={() => router.push(`/work/${id}`)} color={theme.fg} />
        </View>
      </View>
    </View>
  );
}

function Tool({ icon, label, onPress, color }: { icon: string; label: string; onPress: () => void; color: string }) {
  return (
    <Pressable onPress={onPress} style={{ alignItems: 'center', flex: 1 }}>
      <Text style={{ color, fontSize: 15 }}>{icon}</Text>
      <Text style={{ color, opacity: 0.6, fontSize: 9, marginTop: 3 }}>{label}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 8, gap: 10 },
  topIcon: { fontSize: 22 },
  topTitle: { fontSize: 12, fontWeight: '600' },
  topSub: { fontSize: 9, marginTop: 2 },
  chKicker: { fontSize: 9, letterSpacing: 3, marginTop: 18 },
  chTitle: { fontSize: 22, fontWeight: '700', marginTop: 8, lineHeight: 30 },
  para: { marginTop: 14 },
  navRow: { flexDirection: 'row', gap: 10, marginTop: 30 },
  navBtn: { flex: 1, borderWidth: 1, borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  panel: { position: 'absolute', left: 0, right: 0, bottom: 0, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 18, borderTopWidth: 1, borderColor: palette.line },
  pLabel: { color: palette.muted, fontSize: 9, letterSpacing: 2, marginBottom: 8 },
  sizeDot: { width: 34, height: 34, borderRadius: 17, borderWidth: 1, borderColor: palette.line, alignItems: 'center', justifyContent: 'center' },
  sizeOn: { backgroundColor: palette.gold, borderColor: 'transparent' },
  fontBtn: { flex: 1, borderRadius: 10, borderWidth: 1, borderColor: palette.line, paddingVertical: 8, alignItems: 'center' },
  fontOn: { backgroundColor: palette.gold, borderColor: 'transparent' },
  swatch: { width: 38, height: 38, borderRadius: 19, borderWidth: 2 },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 18, paddingTop: 8 },
  progressTrack: { height: 3, backgroundColor: palette.line, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: 3, backgroundColor: palette.gold },
  tools: { flexDirection: 'row', marginTop: 10 },
});
