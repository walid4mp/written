import { create } from 'zustand';
import { supabase } from './supabase';

export type Session = { userId: string; email: string | null } | null;

export type Me = {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  cover_url: string | null;
  bio: string | null;
  account_type: string;
  role: string;
  is_verified: boolean;
  is_vip: boolean;
  highest_badge: string;
  unlimited_publish: boolean;
  free_works_used: number;
  followers_count: number;
  following_count: number;
  works_count: number;
  language: 'ar' | 'fr' | 'en';
};

type AuthState = {
  ready: boolean;
  session: Session;
  me: Me | null;
  init: () => Promise<void>;
  refreshMe: () => Promise<void>;
  signOut: () => Promise<void>;
};

export const useAuth = create<AuthState>((set, get) => ({
  ready: false,
  session: null,
  me: null,

  init: async () => {
    const { data } = await supabase.auth.getSession();
    const s = data.session;
    set({ session: s ? { userId: s.user.id, email: s.user.email ?? null } : null, ready: true });
    if (s) await get().refreshMe();
    supabase.auth.onAuthStateChange(async (_e, session) => {
      set({ session: session ? { userId: session.user.id, email: session.user.email ?? null } : null, me: null });
      if (session) await get().refreshMe();
    });
  },

  refreshMe: async () => {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return;
    const { data } = await supabase
      .from('profiles')
      .select('id,username,display_name,avatar_url,cover_url,bio,account_type,role,is_verified,is_vip,highest_badge,unlimited_publish,free_works_used,followers_count,following_count,works_count,language')
      .eq('id', auth.user.id)
      .maybeSingle();
    set({ me: (data as Me) ?? null });
  },

  signOut: async () => {
    await supabase.auth.signOut({ scope: 'global' });
    set({ session: null, me: null });
  },
}));
