import React, { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { queryClient } from '../src/lib/query';
import { useAuth } from '../src/lib/auth';
import { hydrateLang } from '../src/lib/i18n';
import { palette } from '../src/lib/theme';

function Gate() {
  const { ready, session, init } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => { init(); hydrateLang(); }, []);

  useEffect(() => {
    if (!ready) return;
    const inAuth = segments[0] === '(auth)';
    if (!session && !inAuth) router.replace('/(auth)/sign-in');
    if (session && inAuth) router.replace('/(tabs)');
  }, [ready, session, segments]);

  if (!ready) {
    return (
      <View style={s.boot}>
        <ActivityIndicator color={palette.gold} size="large" />
      </View>
    );
  }

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: palette.ink },
        headerTintColor: palette.text,
        headerShadowVisible: false,
        contentStyle: { backgroundColor: palette.ink },
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="work/[id]" options={{ title: '' }} />
      <Stack.Screen name="read/[id]" options={{ headerShown: false }} />
      <Stack.Screen name="editor/[id]" options={{ title: '' }} />
      <Stack.Screen name="notifications" options={{ title: 'Notifications' }} />
      <Stack.Screen name="settings" options={{ title: 'Settings' }} />
      <Stack.Screen name="subscription" options={{ title: 'Subscription' }} />
      <Stack.Screen name="founders" options={{ title: 'Founding Team' }} />
      <Stack.Screen name="stories" options={{ headerShown: false }} />
      <Stack.Screen name="groups" options={{ title: 'Groups' }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <StatusBar style="light" />
          <Gate />
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const s = StyleSheet.create({
  boot: { flex: 1, backgroundColor: palette.ink, alignItems: 'center', justifyContent: 'center' },
});
