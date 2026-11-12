import { useEffect, useMemo, useState } from 'react';
import { supabase, callAdmin, dt, type Profile, type Role } from '../supabase';
import { Table, StatusBadge, Empty } from '../ui';

const BADGES = ['official', 'writer', 'novelist', 'storyteller', 'poet', 'developer', 'founder', 'vip', 'moderator'];

export default function People({ role }: { role: Role }) {
  const [rows, setRows] = useState<Profile[]>([]);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<'all' | 'staff' | 'verified' | 'banned'>('all');
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [verifs, setVerifs] = useState<any[]>([]);
  const [types, setTypes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const isAdmin = role === 'admin' || role === 'owner';

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from('profiles')
      .select('id,username,display_name,account_type,role,is_verified,is_vip,is_banned,unlimited_publish,free_works_used,created_at,avatar_url,bio')
      .order('created_at', { ascending: false })
      .limit(500);
    if (error) setMsg({ kind: 'err', text: error.message });
    setRows((data as Profile[]) ?? []);

    const { data: v } = await supabase
      .from('verification_requests')
      .select('id,user_id,requested_badge,legal_name,portfolio_url,note,status,created_at,profiles:user_id(username,display_name)')
      .eq('status', 'pending')
      .order('created_at', { ascending: false });
    setVerifs(v ?? []);

    const { data: t } = await supabase
      .from('account_type_requests')
      .select('id,user_id,current_type,requested_type,motivation,status,created_at,profiles:user_id(username,display_name)')
      .eq('status', 'pending')
      .order('created_at', { ascending: false });
    setTypes(t ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return rows.filter((r) => {
      const matchQ =
        !term ||
        r.username.toLowerCase().includes(term) ||
        (r.display_name ?? '').toLowerCase().includes(term);
      const matchF =
        filter === 'all' ||
        (filter === 'staff' && r.role !== 'user') ||
        (filter === 'verified' && r.is_verified) ||
        (filter === 'banned' && r.is_banned);
      return matchQ && matchF;
    });
  }, [rows, q, filter]);

  async function act(body: Record<string, unknown>, label: string) {
    try {
      await callAdmin(body);
      setMsg({ kind: 'ok', text: `${label} — applied` });
      await load();
    } catch (e) {
      setMsg({ kind: 'err', text: `${label} failed: ${(e as Error).message}` });
    }
  }

  async function review(id: string, status: 'approved' | 'rejected') {
    const { error } = await supabase
      .from('verification_requests')
      .update({ status, reviewed_at: new Date().toISOString(), review_note: 'Reviewed in console' })
      .eq('id', id);
    if (error) return setMsg({ kind: 'err', text: error.message });
    setMsg({ kind: 'ok', text: `Verification ${status}` });
    load();
  }

  async function reviewType(id: string, status: 'approved' | 'rejected') {
    const { error } = await supabase
      .from('account_type_requests')
      .update({ status, reviewed_at: new Date().toISOString() })
      .eq('id', id);
    if (error) return setMsg({ kind: 'err', text: error.message });
    setMsg({ kind: 'ok', text: `Account-type request ${status}` });
    load();
  }

  return (
    <>
      <div className="topbar">
        <div>
          <h1>People &amp; Badges</h1>
          <div className="sub">Roles, verification queue, disclosure of exemptions.</div>
        </div>
        <button onClick={load}>Refresh</button>
      </div>

      {msg && <div className={`alert ${msg.kind === 'ok' ? 'ok' : 'err'}`}>{msg.text}</div>}

      <div className="grid c2" style={{ marginBottom: 18 }}>
        <div>
          <h2 style={{ marginBottom: 10 }}>Verification queue ({verifs.length})</h2>
          {verifs.length === 0 ? (
            <Empty text="No pending verification requests." />
          ) : (
            <Table head={['User', 'Badge', 'Requested', '']}>
              {verifs.map((v) => (
                <tr key={v.id}>
                  <td>{v.profiles?.display_name || v.profiles?.username}</td>
                  <td><span className="badge gold">{v.requested_badge}</span></td>
                  <td className="muted">{dt(v.created_at)}</td>
                  <td>
                    <div className="row">
                      <button className="sm primary" onClick={() => review(v.id, 'approved')}>Approve</button>
                      <button className="sm danger" onClick={() => review(v.id, 'rejected')}>Reject</button>
                    </div>
                  </td>
                </tr>
              ))}
            </Table>
          )}
        </div>

        <div>
          <h2 style={{ marginBottom: 10 }}>Account-type requests ({types.length})</h2>
          {types.length === 0 ? (
            <Empty text="No pending account-type requests." />
          ) : (
            <Table head={['User', 'From → To', '']}>
              {types.map((t) => (
                <tr key={t.id}>
                  <td>{t.profiles?.display_name || t.profiles?.username}</td>
                  <td className="muted">{t.current_type} → {t.requested_type}</td>
                  <td>
                    <div className="row">
                      <button className="sm primary" onClick={() => reviewType(t.id, 'approved')}>Approve</button>
                      <button className="sm danger" onClick={() => reviewType(t.id, 'rejected')}>Reject</button>
                    </div>
                  </td>
                </tr>
              ))}
            </Table>
          )}
        </div>
      </div>

      <div className="row between" style={{ marginBottom: 12 }}>
        <div className="pill-tabs" style={{ marginBottom: 0 }}>
          {(['all', 'staff', 'verified', 'banned'] as const).map((f) => (
            <button key={f} className={filter === f ? 'active' : ''} onClick={() => setFilter(f)}>
              {f}
            </button>
          ))}
        </div>
        <input
          style={{ maxWidth: 280 }}
          placeholder="Search username or name…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="card muted">Loading directory…</div>
      ) : (
        <Table head={['User', 'Type', 'Role', 'Badges', 'Quota', 'Actions']}>
          {filtered.map((p) => (
            <tr key={p.id}>
              <td>
                <b>{p.display_name || p.username}</b>
                <div className="muted mono">@{p.username}</div>
              </td>
              <td className="muted">{p.account_type}</td>
              <td>
                <span className={`badge ${p.role !== 'user' ? 'gold' : ''}`}>{p.role}</span>
                {p.is_banned && <span className="badge bad" style={{ marginLeft: 6 }}>banned</span>}
              </td>
              <td>
                {p.is_verified && <span className="badge ok">verified</span>}
                {p.is_vip && <span className="badge gold" style={{ marginLeft: 4 }}>vip</span>}
                {p.unlimited_publish && <span className="badge gold" style={{ marginLeft: 4 }}>unlimited</span>}
                {!p.is_verified && !p.is_vip && !p.unlimited_publish && <span className="muted">—</span>}
              </td>
              <td className="muted">{p.free_works_used}</td>
              <td>
                <div className="row">
                  <select
                    className="sm"
                    style={{ width: 132, padding: '4px 6px', fontSize: 12 }}
                    defaultValue=""
                    disabled={!isAdmin}
                    onChange={(e) => {
                      if (!e.target.value) return;
                      if (e.target.value.startsWith('badge:')) {
                        act({ action: 'grant_badge', user_id: p.id, badge: e.target.value.split(':')[1] }, 'Grant badge');
                      } else if (e.target.value.startsWith('role:')) {
                        act({ action: 'set_role', user_id: p.id, role: e.target.value.split(':')[1] }, 'Change role');
                      } else if (e.target.value === 'exempt') {
                        act({ action: 'grant_exemption', user_id: p.id, kind: 'publish_fee', days: 365, reason: 'Console grant' }, 'Grant exemption');
                      } else if (e.target.value === 'unlimited') {
                        act({ action: 'grant_exemption', user_id: p.id, kind: 'unlimited_publish', reason: 'Console grant' }, 'Grant unlimited publishing');
                      }
                      e.currentTarget.value = '';
                    }}
                  >
                    <option value="">— admin action —</option>
                    <optgroup label="Grant badge">
                      {BADGES.map((b) => <option key={b} value={`badge:${b}`}>{b}</option>)}
                    </optgroup>
                    <optgroup label="Role">
                      {['moderator', 'admin', 'user'].map((r) => <option key={r} value={`role:${r}`}>{r}</option>)}
                    </optgroup>
                    <optgroup label="Exemptions">
                      <option value="exempt">Exempt 1 year</option>
                      <option value="unlimited">Unlimited publishing</option>
                    </optgroup>
                  </select>
                  <button
                    className={`sm ${p.is_banned ? '' : 'danger'}`}
                    disabled={!isAdmin}
                    onClick={() =>
                      act(
                        { action: p.is_banned ? 'unban_user' : 'ban_user', user_id: p.id, reason: 'Console' },
                        p.is_banned ? 'Unban' : 'Ban',
                      )
                    }
                  >
                    {p.is_banned ? 'Unban' : 'Ban'}
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </Table>
      )}

      <div className="card" style={{ marginTop: 14 }}>
        <b>Note.</b>{' '}
        <span className="muted">
          Badge, role and exemption changes are executed by the <code>admin-action</code> edge
          function, which re-verifies your JWT and database role on every call. The browser never
          touches the secret key.
        </span>
      </div>
    </>
  );
}
