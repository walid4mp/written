import React from 'react';
import { Tabs, useRouter } from 'expo-router';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { palette } from '../../src/lib/theme';
import { useI18n } from '../../src/lib/i18n';

function TabIcon({ label, focused, glyph }: { label: string; focused: boolean; glyph: string }) {
  return (
    <View style={s.tab}>
      <Text style={[s.glyph, { color: focused ? palette.goldSoft : palette.muted }]}>{glyph}</Text>
      <Text style={[s.lbl, { color: focused ? palette.goldSoft : palette.muted }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

export default function TabsLayout() {
  const { t } = useI18n();
  const router = useRouter();

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: palette.ink },
        headerTitleStyle: { color: palette.text, fontFamily: 'CormorantGaramond_600SemiBold' },
        headerShadowVisible: false,
        tabBarStyle: {
          backgroundColor: '#101013',
          borderTopColor: palette.line,
          height: 74,
          paddingBottom: 14,
          paddingTop: 8,
        },
        tabBarShowLabel: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t('app_name'),
          tabBarIcon: ({ focused }) => <TabIcon label={t('home')} focused={focused} glyph="◆" />,
        }}
      />
      <Tabs.Screen
        name="discover"
        options={{
          title: t('discover'),
          tabBarIcon: ({ focused }) => <TabIcon label={t('discover')} focused={focused} glyph="◇" />,
        }}
      />
      <Tabs.Screen
        name="write"
        options={{
          title: t('write'),
          tabBarButton: (props) => (
            <Pressable
              onPress={() => router.push('/editor/new')}
              style={s.centerWrap}
              accessibilityRole="button"
              accessibilityLabel={t('new_work')}
            >
              <View style={s.centerBtn}>
                <Text style={s.plus}>✎</Text>
              </View>
            </Pressable>
          ),
          tabBarIcon: () => null,
        }}
      />
      <Tabs.Screen
        name="library"
        options={{
          title: t('library'),
          tabBarIcon: ({ focused }) => <TabIcon label={t('library')} focused={focused} glyph="❏" />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t('profile'),
          tabBarIcon: ({ focused }) => <TabIcon label={t('profile')} focused={focused} glyph="◉" />,
        }}
      />
    </Tabs>
  );
}

const s = StyleSheet.create({
  tab: { alignItems: 'center', justifyContent: 'center', gap: 3, width: 76 },
  glyph: { fontSize: 17 },
  lbl: { fontSize: 10, fontWeight: '600' },
  centerWrap: { top: -16, alignItems: 'center', justifyContent: 'center', flex: 1 },
  centerBtn: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: palette.gold,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: palette.gold,
    shadowOpacity: 0.5,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 10,
  },
  plus: { color: '#1A1405', fontSize: 22, fontWeight: '700' },
});
