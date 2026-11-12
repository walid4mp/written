import { createClient } from '@supabase/supabase-js';

// The publishable (anon) key is a PUBLIC client key by design — RLS decides what
// a session can read or write. The service/secret key is NEVER present here.
const FALLBACK_URL = 'https://rkzzrlgjmoptkoxppxtk.supabase.co';
const FALLBACK_KEY = 'sb_publishable_sjF3hyLw1JEkWQqsMem4vQ_pIUUT9Ib';

export const SUPABASE_URL: string = (import.meta.env.VITE_SUPABASE_URL as string) || FALLBACK_URL;
export const SUPABASE_KEY: string =
  (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string) || FALLBACK_KEY;

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true },
});

export type Role = 'user' | 'developer' | 'moderator' | 'admin' | 'owner';

export type Profile = {
  id: string;
  username: string;
  display_name: string;
  account_type: string;
  role: Role;
  is_verified: boolean;
  is_vip: boolean;
  is_banned: boolean;
  unlimited_publish: boolean;
  free_works_used: number;
  created_at: string;
  avatar_url: string | null;
  bio: string | null;
};

export const money = (n: number | string | null | undefined, cur = 'USD') =>
  `${Number(n ?? 0).toFixed(2)} ${cur}`;

export const dt = (v: string | null | undefined) => (v ? new Date(v).toLocaleString() : '—');

export async function callAdmin(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke('admin-action', { body });
  if (error) throw new Error(error.message);
  if (data && data.ok === false) throw new Error(data.error ?? 'action_failed');
  return data;
}
