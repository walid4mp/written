import { useEffect, useState } from 'react';
import { supabase, callAdmin, dt } from '../supabase';
import { Table, StatusBadge, Empty } from '../ui';

export default function Safety() {
  const [tab, setTab] = useState<'reports' | 'audit' | 'webhooks' | 'founders'>('reports');
  const [reports, setReports] = useState<any[]>([]);
  const [audit, setAudit] = useState<any[]>([]);
  const [hooks, setHooks] = useState<any[]>([]);
  const [founders, setFounders] = useState<any[]>([]);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  async function load() {
    const { data: r } = await supabase
      .from('reports')
      .select('id,target_type,target_id,reason,details,status,created_at,profiles:reporter_id(username)')
      .order('created_at', { ascending: false })
      .limit(150);
    setReports(r ?? []);

    const { data: a } = await supabase
      .from('audit_logs')
      .select('id,actor_id,actor_role,table_name,action,row_id,created_at')
      .order('created_at', { ascending: false })
      .limit(150);
    setAudit(a ?? []);

    const { data: h } = await supabase
      .from('webhook_events')
      .select('id,provider,event_id,event_type,signature_ok,processed,error,created_at')
      .order('created_at', { ascending: false })
      .limit(80);
    setHooks(h ?? []);

    const { data: f } = await supabase.from('founders').select('*').order('sort_order');
    setFounders(f ?? []);
  }

  useEffect(() => { load(); }, []);

  async function resolve(id: string, status: 'resolved' | 'dismissed' | 'reviewing') {
    const { error } = await supabase
      .from('reports')
      .update({ status, handled_at: new Date().toISOString(), action_note: `Console: ${status}` })
      .eq('id', id);
    setMsg(error ? { kind: 'err', text: error.message } : { kind: 'ok', text: `Report ${status}` });
    load();
  }

  async function saveFounder(f: any, form: HTMLFormElement) {
    const fd = new FormData(form);
    const patch = {
      id: f.id,
      slug: f.slug,
      full_name: String(fd.get('full_name') ?? f.full_name),
      role_title: String(fd.get('role_title') ?? f.role_title),
      role_title_ar: String(fd.get('role_title_ar') ?? ''),
      bio: String(fd.get('bio') ?? ''),
      bio_ar: String(fd.get('bio_ar') ?? ''),
      instagram_url: String(fd.get('instagram_url') ?? ''),
      tiktok_url: String(fd.get('tiktok_url') ?? ''),
      is_primary_author: fd.get('is_primary_author') === 'on',
      ownership_verified: fd.get('ownership_verified') === 'on',
    };
    const { error } = await supabase.from('founders').update(patch).eq('id', f.id);
    setMsg(error ? { kind: 'err', text: error.message } : { kind: 'ok', text: 'Founding team updated' });
    load();
  }

  return (
    <>
      <div className="topbar">
        <div>
          <h1>Safety &amp; Audit</h1>
          <div className="sub">Reports, immutable audit trail, webhook ledger, founding team.</div>
        </div>
        <button onClick={load}>Refresh</button>
      </div>

      {msg && <div className={`alert ${msg.kind === 'ok' ? 'ok' : 'err'}`}>{msg.text}</div>}

      <div className="pill-tabs">
        {(['reports', 'audit', 'webhooks', 'founders'] as const).map((t) => (
          <button key={t} className={tab === t ? 'active' : ''} onClick={() => setTab(t)}>{t}</button>
        ))}
      </div>

      {tab === 'reports' && (
        reports.length === 0 ? <Empty text="No reports." /> : (
          <Table head={['Type', 'Reason', 'Reporter', 'State', 'When', '']}>
            {reports.map((r) => (
              <tr key={r.id}>
                <td className="muted">{r.target_type}</td>
                <td>{r.reason}<div className="muted" style={{ fontSize: 11 }}>{(r.details ?? '').slice(0, 80)}</div></td>
                <td className="muted">{r.profiles?.username}</td>
                <td><StatusBadge value={r.status} /></td>
                <td className="muted">{dt(r.created_at)}</td>
                <td>
                  <div className="row">
                    <button className="sm primary" onClick={() => resolve(r.id, 'resolved')}>Resolve</button>
                    <button className="sm" onClick={() => resolve(r.id, 'dismissed')}>Dismiss</button>
                  </div>
                </td>
              </tr>
            ))}
          </Table>
        )
      )}

      {tab === 'audit' && (
        audit.length === 0 ? <Empty text="No audit entries yet — they appear as soon as a sensitive table changes." /> : (
          <Table head={['Table', 'Action', 'Actor role', 'Row', 'When']}>
            {audit.map((a) => (
              <tr key={a.id}>
                <td className="mono">{a.table_name}</td>
                <td><StatusBadge value={a.action} /></td>
                <td className="muted">{a.actor_role ?? 'system'}</td>
                <td className="mono muted">{(a.row_id ?? '').slice(0, 12)}</td>
                <td className="muted">{dt(a.created_at)}</td>
              </tr>
            ))}
          </Table>
        )
      )}

      {tab === 'webhooks' && (
        hooks.length === 0 ? <Empty text="No webhook deliveries recorded yet." /> : (
          <Table head={['Provider', 'Event', 'Signature', 'Processed', 'When', 'Error']}>
            {hooks.map((h) => (
              <tr key={h.id}>
                <td className="muted">{h.provider}</td>
                <td className="mono">{h.event_type}</td>
                <td><span className={`badge ${h.signature_ok ? 'ok' : 'bad'}`}>{h.signature_ok ? 'valid' : 'invalid'}</span></td>
                <td><span className={`badge ${h.processed ? 'ok' : 'warn'}`}>{h.processed ? 'yes' : 'no'}</span></td>
                <td className="muted">{dt(h.created_at)}</td>
                <td className="muted">{(h.error ?? '—').slice(0, 40)}</td>
              </tr>
            ))}
          </Table>
        )
      )}

      {tab === 'founders' && (
        <div className="grid c2">
          {founders.map((f) => (
            <form key={f.id} className="card" onSubmit={(e) => { e.preventDefault(); saveFounder(f, e.currentTarget); }}>
              <div className="row between">
                <h2>{f.full_name}</h2>
                {f.ownership_verified ? <span className="badge ok">ownership verified</span> : <span className="badge warn">unverified</span>}
              </div>
              <label className="field" style={{ marginTop: 10 }}><span>Name</span><input name="full_name" defaultValue={f.full_name} /></label>
              <label className="field"><span>Role (EN)</span><input name="role_title" defaultValue={f.role_title} /></label>
              <label className="field"><span>Role (AR)</span><input name="role_title_ar" defaultValue={f.role_title_ar ?? ''} /></label>
              <label className="field"><span>Bio (EN)</span><textarea name="bio" defaultValue={f.bio ?? ''} /></label>
              <label className="field"><span>Bio (AR)</span><textarea name="bio_ar" defaultValue={f.bio_ar ?? ''} /></label>
              <label className="field"><span>Instagram</span><input name="instagram_url" defaultValue={f.instagram_url ?? ''} /></label>
              <label className="field"><span>TikTok</span><input name="tiktok_url" defaultValue={f.tiktok_url ?? ''} /></label>
              <label className="row" style={{ fontSize: 12, marginBottom: 8 }}>
                <input type="checkbox" name="is_primary_author" defaultChecked={f.is_primary_author} style={{ width: 'auto' }} /> primary author
              </label>
              <label className="row" style={{ fontSize: 12, marginBottom: 10 }}>
                <input type="checkbox" name="ownership_verified" defaultChecked={f.ownership_verified} style={{ width: 'auto' }} /> ownership proven
              </label>
              <button className="primary" style={{ width: '100%' }}>Save</button>
            </form>
          ))}
        </div>
      )}
    </>
  );
}
