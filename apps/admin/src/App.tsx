import { useEffect, useState } from 'react';
import { supabase, type Profile, type Role } from './supabase';
import { Logo } from './ui';
import Overview from './views/Overview';
import People from './views/People';
import Content from './views/Content';
import Commerce from './views/Commerce';
import Safety from './views/Safety';
import Settings from './views/Settings';

type View = 'overview' | 'people' | 'content' | 'commerce' | 'safety' | 'settings';

const NAV: { key: View; label: string; ico: string; min: Role[] }[] = [
  { key: 'overview', label: 'Overview', ico: '◈', min: ['moderator', 'admin', 'owner'] },
  { key: 'people', label: 'People & Badges', ico: '◉', min: ['moderator', 'admin', 'owner'] },
  { key: 'content', label: 'Works & Content', ico: '❏', min: ['moderator', 'admin', 'owner'] },
  { key: 'commerce', label: 'Money', ico: '◊', min: ['admin', 'owner'] },
  { key: 'safety', label: 'Safety & Audit', ico: '⚑', min: ['moderator', 'admin', 'owner'] },
  { key: 'settings', label: 'Settings', ico: '⚙', min: ['admin', 'owner'] },
];

const STAFF: Role[] = ['moderator', 'admin', 'owner', 'developer'];

export default function App() {
  const [session, setSession] = useState<boolean | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState('');
  const [view, setView] = useState<View>('overview');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  async function loadProfile() {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) {
      setSession(false);
      setProfile(null);
      return;
    }
    const { data, error: pErr } = await supabase
      .from('profiles')
      .select('id,username,display_name,account_type,role,is_verified,is_vip,is_banned,unlimited_publish,free_works_used,created_at,avatar_url,bio')
      .eq('id', auth.user.id)
      .maybeSingle();
    if (pErr) setError(pErr.message);
    setProfile((data as Profile) ?? null);
    setSession(true);
  }

  useEffect(() => {
    loadProfile();
    const { data: sub } = supabase.auth.onAuthStateChange(() => loadProfile());
    return () => sub.subscription.unsubscribe();
  }, []);

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const { error: sErr } = await supabase.auth.signInWithPassword({ email, password });
    if (sErr) setError(sErr.message);
    await loadProfile();
    setBusy(false);
  }

  if (session === null) {
    return (
      <div className="login-wrap">
        <div className="login">
          <Logo size={44} />
          <h1>SARAD</h1>
          <p className="tag">Consol · signing in…</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="login-wrap">
        <form className="login" onSubmit={signIn}>
          <div style={{ display: 'grid', placeItems: 'center' }}>
            <Logo size={44} />
          </div>
          <h1>SARAD</h1>
          <p className="tag">ADMIN CONSOLE · AUTHORIZED STAFF ONLY</p>
          {error && <div className="alert err">{error}</div>}
          <label className="field">
            <span>Email</span>
            <input
              type="email"
              required
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@sarad.app"
            />
          </label>
          <label className="field">
            <span>Password</span>
            <input
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </label>
          <button className="primary" style={{ width: '100%' }} disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
          <p className="muted" style={{ fontSize: 11, marginTop: 14, lineHeight: 1.6 }}>
            Access is verified against your database role. A signed-in account without a staff
            role can authenticate here but every widget will return “forbidden”.
          </p>
        </form>
      </div>
    );
  }

  const role = (profile?.role ?? 'user') as Role;
  const isStaff = STAFF.includes(role);

  if (!isStaff) {
    return (
      <div className="login-wrap">
        <div className="login">
          <Logo size={40} />
          <h1>SARAD</h1>
          <p className="tag">NO STAFF ROLE</p>
          <div className="alert err">
            {profile?.display_name || profile?.username} has role <b>{role}</b>. This console
            requires moderator, admin or owner.
          </div>
          <button onClick={() => supabase.auth.signOut()}>Sign out</button>
        </div>
      </div>
    );
  }

  const nav = NAV.filter((n) => n.min.includes(role));

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <Logo size={30} />
          <div>
            <b>SARAD</b>
            <small>CONSOLE</small>
          </div>
        </div>
        {nav.map((n) => (
          <button
            key={n.key}
            className={`nav-item ${view === n.key ? 'active' : ''}`}
            onClick={() => setView(n.key)}
          >
            <span className="ico">{n.ico}</span> {n.label}
          </button>
        ))}
        <div className="spacer" />
        <div className="me">
          <b>{profile?.display_name || profile?.username}</b>
          <span className="muted">
            {role} · {profile?.account_type}
          </span>
          <div style={{ marginTop: 8 }}>
            <button className="sm ghost" onClick={() => supabase.auth.signOut()}>
              Sign out
            </button>
          </div>
        </div>
      </aside>

      <main className="main">
        {view === 'overview' && <Overview role={role} />}
        {view === 'people' && <People role={role} />}
        {view === 'content' && <Content role={role} />}
        {view === 'commerce' && <Commerce />}
        {view === 'safety' && <Safety />}
        {view === 'settings' && <Settings />}
      </main>
    </div>
  );
}
