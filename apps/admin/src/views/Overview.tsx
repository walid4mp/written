import { useEffect, useState } from 'react';
import { supabase, money, dt, type Role } from '../supabase';
import { Table, StatusBadge } from '../ui';

type Stats = Record<string, number>;

export default function Overview({ role }: { role: Role }) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState('');
  const [pending, setPending] = useState<any[]>([]);
  const [recent, setRecent] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const { data, error: e } = await supabase.rpc('admin_stats');
      if (e) setError(e.message);
      else setStats(data as Stats);

      const { data: w } = await supabase
        .from('works')
        .select('id,title,kind,author_id,created_at,status,profiles:author_id(username,display_name)')
        .eq('status', 'pending_review')
        .order('created_at', { ascending: false })
        .limit(8);
      setPending(w ?? []);

      const { data: p } = await supabase
        .from('payments')
        .select('id,amount,currency,status,purpose,created_at')
        .order('created_at', { ascending: false })
        .limit(8);
      setRecent(p ?? []);
    })();
  }, []);

  const cards: [string, string, boolean][] = [
    ['users_total', 'Users', false],
    ['users_active_30d', 'Active (30d)', false],
    ['authors', 'Authors', false],
    ['works_published', 'Published works', true],
    ['works_pending', 'Awaiting review', false],
    ['chapters_total', 'Chapters', false],
    ['posts_total', 'Posts', false],
    ['stories_total', 'Stories', false],
    ['groups_total', 'Groups', false],
    ['subs_active', 'Active subs', true],
    ['revenue_total', 'Revenue', true],
    ['payments_failed', 'Failed payments', false],
  ];

  return (
    <>
      <div className="topbar">
        <div>
          <h1>Overview</h1>
          <div className="sub">Live counters computed by the security-definer <code>admin_stats()</code> RPC.</div>
        </div>
      </div>

      {error && <div className="alert err">{error}</div>}

      <div className="grid c4" style={{ marginBottom: 18 }}>
        {cards.map(([key, label, gold]) => (
          <div className={`card stat ${gold ? 'gold' : ''}`} key={key}>
            <small>{label}</small>
            <b>
              {stats
                ? key === 'revenue_total'
                  ? money(stats[key])
                  : (stats[key] ?? 0).toLocaleString()
                : '—'}
            </b>
          </div>
        ))}
      </div>

      <div className="grid c2">
        <div>
          <h2 style={{ marginBottom: 10 }}>Awaiting review</h2>
          {pending.length === 0 ? (
            <div className="card muted">Nothing in the queue.</div>
          ) : (
            <Table head={['Title', 'Kind', 'Author', 'Submitted']}>
              {pending.map((w) => (
                <tr key={w.id}>
                  <td>{w.title}</td>
                  <td className="muted">{w.kind}</td>
                  <td>{w.profiles?.display_name || w.profiles?.username || '—'}</td>
                  <td className="muted">{dt(w.created_at)}</td>
                </tr>
              ))}
            </Table>
          )}
        </div>

        <div>
          <h2 style={{ marginBottom: 10 }}>Latest payments</h2>
          {recent.length === 0 ? (
            <div className="card muted">No transactions yet.</div>
          ) : (
            <Table head={['Amount', 'Purpose', 'Status', 'When']}>
              {recent.map((p) => (
                <tr key={p.id}>
                  <td>{money(p.amount, p.currency)}</td>
                  <td className="muted">{p.purpose}</td>
                  <td><StatusBadge value={p.status} /></td>
                  <td className="muted">{dt(p.created_at)}</td>
                </tr>
              ))}
            </Table>
          )}
        </div>
      </div>

      <div className="card" style={{ marginTop: 18 }}>
        <h2 style={{ marginBottom: 8 }}>Security posture</h2>
        <div className="kv"><span>Row Level Security</span><span className="badge ok">enabled · 45 tables</span></div>
        <div className="kv"><span>Client payment writes</span><span className="badge ok">blocked (webhook only)</span></div>
        <div className="kv"><span>Self-assigned badges / roles</span><span className="badge ok">blocked by guard triggers</span></div>
        <div className="kv"><span>Your role</span><span className="badge gold">{role}</span></div>
      </div>
    </>
  );
}
