import { useEffect, useState } from 'react';
import { supabase, callAdmin, money, dt } from '../supabase';
import { Table, StatusBadge, Empty } from '../ui';

export default function Commerce() {
  const [tab, setTab] = useState<'payments' | 'subs' | 'plans' | 'coupons' | 'exemptions'>('payments');
  const [payments, setPayments] = useState<any[]>([]);
  const [subs, setSubs] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const [coupons, setCoupons] = useState<any[]>([]);
  const [exemptions, setExemptions] = useState<any[]>([]);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  async function load() {
    const { data: p } = await supabase
      .from('payments')
      .select('id,amount,currency,status,purpose,provider,provider_ref,created_at,profiles:user_id(username)')
      .order('created_at', { ascending: false })
      .limit(200);
    setPayments(p ?? []);

    const { data: s } = await supabase
      .from('subscriptions')
      .select('id,status,provider,current_period_end,cancel_at_period_end,is_grant,created_at,profiles:user_id(username),plans:plan_id(name_en,price,interval)')
      .order('created_at', { ascending: false })
      .limit(200);
    setSubs(s ?? []);

    const { data: pl } = await supabase.from('plans').select('*').order('sort_order');
    setPlans(pl ?? []);

    const { data: c } = await supabase.from('coupons').select('*').order('created_at', { ascending: false });
    setCoupons(c ?? []);

    const { data: e } = await supabase
      .from('exemptions')
      .select('id,kind,reason,is_active,starts_at,expires_at,revoked_at,user_id,profiles:user_id(username)')
      .order('starts_at', { ascending: false })
      .limit(200);
    setExemptions(e ?? []);
  }

  useEffect(() => { load(); }, []);

  async function savePlan(plan: any) {
    try {
      await callAdmin({ action: 'upsert_plan', plan });
      setMsg({ kind: 'ok', text: `Plan ${plan.code} saved` });
      load();
    } catch (e) { setMsg({ kind: 'err', text: (e as Error).message }); }
  }

  async function saveCoupon(coupon: any) {
    try {
      await callAdmin({ action: 'upsert_coupon', coupon });
      setMsg({ kind: 'ok', text: `Coupon ${coupon.code} saved` });
      load();
    } catch (e) { setMsg({ kind: 'err', text: (e as Error).message }); }
  }

  async function revoke(id: string) {
    try {
      await callAdmin({ action: 'revoke_exemption', exemption_id: id });
      setMsg({ kind: 'ok', text: 'Exemption revoked' });
      load();
    } catch (e) { setMsg({ kind: 'err', text: (e as Error).message }); }
  }

  const revenue = payments
    .filter((p) => p.status === 'succeeded')
    .reduce((a, p) => a + Number(p.amount), 0);

  return (
    <>
      <div className="topbar">
        <div>
          <h1>Money</h1>
          <div className="sub">
            {payments.filter((p) => p.status === 'succeeded').length} succeeded payments ·{' '}
            <b>{money(revenue)}</b> recorded revenue
          </div>
        </div>
        <button onClick={load}>Refresh</button>
      </div>

      {msg && <div className={`alert ${msg.kind === 'ok' ? 'ok' : 'err'}`}>{msg.text}</div>}

      <div className="alert ok" style={{ background: 'rgba(201,162,39,0.10)', borderColor: 'rgba(201,162,39,0.35)', color: '#f0dfa8' }}>
        Payments can only reach <b>succeeded</b> through the signature-verified
        <code> stripe-webhook</code> edge function. There is no INSERT/UPDATE policy for clients on
        the <code> payments</code> table, so an app can never self-credit a purchase.
      </div>

      <div className="pill-tabs">
        {(['payments', 'subs', 'plans', 'coupons', 'exemptions'] as const).map((t) => (
          <button key={t} className={tab === t ? 'active' : ''} onClick={() => setTab(t)}>{t}</button>
        ))}
      </div>

      {tab === 'payments' && (
        payments.length === 0 ? <Empty text="No payments recorded yet." /> : (
          <Table head={['User', 'Amount', 'Purpose', 'Status', 'Provider', 'Ref', 'When']}>
            {payments.map((p) => (
              <tr key={p.id}>
                <td>{p.profiles?.username ?? '—'}</td>
                <td><b>{money(p.amount, p.currency)}</b></td>
                <td className="muted">{p.purpose}</td>
                <td><StatusBadge value={p.status} /></td>
                <td className="muted">{p.provider}</td>
                <td className="mono muted">{(p.provider_ref ?? '—').slice(0, 22)}</td>
                <td className="muted">{dt(p.created_at)}</td>
              </tr>
            ))}
          </Table>
        )
      )}

      {tab === 'subs' && (
        subs.length === 0 ? <Empty text="No subscriptions yet." /> : (
          <Table head={['User', 'Plan', 'Status', 'Renews', 'Grant', 'Provider']}>
            {subs.map((s) => (
              <tr key={s.id}>
                <td>{s.profiles?.username ?? '—'}</td>
                <td>{s.plans?.name_en} <span className="muted">({s.plans?.interval})</span></td>
                <td><StatusBadge value={s.status} /></td>
                <td className="muted">{dt(s.current_period_end)}</td>
                <td>{s.is_grant ? <span className="badge gold">granted</span> : '—'}</td>
                <td className="muted">{s.provider}</td>
              </tr>
            ))}
          </Table>
        )
      )}

      {tab === 'plans' && (
        <div className="grid c3">
          {plans.map((p) => (
            <form
              key={p.id}
              className="card"
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                savePlan({
                  id: p.id,
                  code: p.code,
                  name_en: String(f.get('name_en')),
                  name_ar: String(f.get('name_ar')),
                  name_fr: String(f.get('name_fr')),
                  price: Number(f.get('price')),
                  interval: String(f.get('interval')),
                  is_active: f.get('is_active') === 'on',
                });
              }}
            >
              <div className="row between">
                <h2>{p.code}</h2>
                <span className={`badge ${p.is_active ? 'ok' : 'bad'}`}>{p.is_active ? 'active' : 'off'}</span>
              </div>
              <label className="field" style={{ marginTop: 10 }}>
                <span>Name (EN)</span><input name="name_en" defaultValue={p.name_en} />
              </label>
              <label className="field"><span>Name (AR)</span><input name="name_ar" defaultValue={p.name_ar} /></label>
              <label className="field"><span>Name (FR)</span><input name="name_fr" defaultValue={p.name_fr} /></label>
              <div className="row">
                <label className="field" style={{ flex: 1 }}>
                  <span>Price</span><input name="price" type="number" step="0.01" defaultValue={p.price} />
                </label>
                <label className="field" style={{ flex: 1 }}>
                  <span>Interval</span>
                  <select name="interval" defaultValue={p.interval}>
                    <option value="month">month</option>
                    <option value="year">year</option>
                    <option value="lifetime">lifetime</option>
                  </select>
                </label>
              </div>
              <label className="row" style={{ fontSize: 12, marginBottom: 10 }}>
                <input type="checkbox" name="is_active" defaultChecked={p.is_active} style={{ width: 'auto' }} /> active
              </label>
              <button className="primary" style={{ width: '100%' }}>Save plan</button>
            </form>
          ))}
        </div>
      )}

      {tab === 'coupons' && (
        <>
          <form
            className="card"
            style={{ marginBottom: 14 }}
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              saveCoupon({
                code: String(f.get('code')).toUpperCase(),
                percent_off: Number(f.get('percent_off')) || null,
                amount_off: Number(f.get('amount_off')) || null,
                applies_to: String(f.get('applies_to')),
                max_redemptions: Number(f.get('max_redemptions')) || null,
                is_active: true,
              });
            }}
          >
            <h2 style={{ marginBottom: 10 }}>New coupon</h2>
            <div className="row">
              <input name="code" placeholder="CODE" required style={{ maxWidth: 180 }} />
              <input name="percent_off" type="number" placeholder="% off" style={{ maxWidth: 110 }} />
              <input name="amount_off" type="number" placeholder="amount off" style={{ maxWidth: 130 }} />
              <input name="max_redemptions" type="number" placeholder="max uses" style={{ maxWidth: 120 }} />
              <select name="applies_to" style={{ maxWidth: 180 }}>
                <option value="any">any</option>
                <option value="subscription">subscription</option>
                <option value="publish_fee">publish fee</option>
                <option value="work_purchase">work purchase</option>
              </select>
              <button className="primary">Create</button>
            </div>
          </form>
          {coupons.length === 0 ? <Empty text="No coupons." /> : (
            <Table head={['Code', '%', 'Amount', 'Scope', 'Used', 'Active']}>
              {coupons.map((c) => (
                <tr key={c.id}>
                  <td className="mono"><b>{c.code}</b></td>
                  <td className="muted">{c.percent_off ?? '—'}</td>
                  <td className="muted">{c.amount_off ?? '—'}</td>
                  <td className="muted">{c.applies_to}</td>
                  <td className="muted">{c.redeemed}/{c.max_redemptions ?? '∞'}</td>
                  <td><span className={`badge ${c.is_active ? 'ok' : 'bad'}`}>{c.is_active ? 'yes' : 'no'}</span></td>
                </tr>
              ))}
            </Table>
          )}
        </>
      )}

      {tab === 'exemptions' && (
        exemptions.length === 0 ? <Empty text="No exemptions granted." /> : (
          <Table head={['User', 'Kind', 'Reason', 'Expires', 'State', '']}>
            {exemptions.map((x) => {
              const live = x.is_active && !x.revoked_at && (!x.expires_at || new Date(x.expires_at) > new Date());
              return (
                <tr key={x.id}>
                  <td>{x.profiles?.username ?? '—'}</td>
                  <td><span className="badge gold">{x.kind}</span></td>
                  <td className="muted">{x.reason ?? '—'}</td>
                  <td className="muted">{x.expires_at ? dt(x.expires_at) : 'permanent'}</td>
                  <td><span className={`badge ${live ? 'ok' : 'bad'}`}>{live ? 'active' : 'inactive'}</span></td>
                  <td><button className="sm danger" onClick={() => revoke(x.id)}>Revoke</button></td>
                </tr>
              );
            })}
          </Table>
        )
      )}
    </>
  );
}
