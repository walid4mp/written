import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { palette } from '../src/lib/theme';

/** Cinematic splash: the SARAD mark draws in, the wordmark breathes, then the gate routes. */
export default function Splash() {
  const router = useRouter();
  const ring = useRef(new Animated.Value(0)).current;
  const word = useRef(new Animated.Value(0)).current;
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.timing(ring, { toValue: 1, duration: 900, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(fade, { toValue: 1, duration: 700, useNativeDriver: true }),
      ]),
      Animated.timing(word, { toValue: 1, duration: 700, easing: Easing.out(Easing.quad), useNativeDriver: true }),
    ]).start();

    const t = setTimeout(() => router.replace('/(auth)/sign-in'), 2400);
    return () => clearTimeout(t);
  }, []);

  return (
    <View style={s.wrap}>
      <LinearGradient colors={['#0B0B0C', '#141208', '#0B0B0C']} style={StyleSheet.absoluteFill} />
      <Animated.View style={[s.ring, { opacity: fade, transform: [{ scale: ring.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }] }]}>
        <Text style={s.glyph}>س</Text>
      </Animated.View>
      <Animated.Text style={[s.word, { opacity: word, letterSpacing: word.interpolate({ inputRange: [0, 1], outputRange: [14, 8] }) }]}>
        SARAD
      </Animated.Text>
      <Animated.Text style={[s.tag, { opacity: word }]}>حيث تُروى الحكايات</Animated.Text>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.ink },
  ring: {
    width: 132, height: 132, borderRadius: 66, borderWidth: 1.5, borderColor: palette.gold + '88',
    alignItems: 'center', justifyContent: 'center', marginBottom: 26,
  },
  glyph: { color: palette.goldSoft, fontSize: 58, fontWeight: '300' },
  word: { color: palette.text, fontSize: 30, fontWeight: '600' },
  tag: { color: palette.muted, marginTop: 12, fontSize: 13, letterSpacing: 1 },
});
