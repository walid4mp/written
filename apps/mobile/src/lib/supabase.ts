import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

// Only the PUBLISHABLE key ever ships in the app. RLS decides everything.
// The service/secret key must stay on the server (edge functions only).
const extra = (Constants.expoConfig?.extra ?? {}) as Record<string, string>;

export const SUPABASE_URL =
  process.env.EXPO_PUBLIC_SUPABASE_URL || extra.supabaseUrl || 'https://rkzzrlgjmoptkoxppxtk.supabase.co';

export const SUPABASE_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  extra.supabaseKey ||
  'sb_publishable_sjF3hyLw1JEkWQqsMem4vQ_pIUUT9Ib';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    storage: AsyncStorage as never,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
