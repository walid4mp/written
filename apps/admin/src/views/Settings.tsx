import { useEffect, useState } from 'react';
import { supabase, callAdmin } from '../supabase';

type Settings = {
  app_name: string;
  default_language: string;
  publish_policy: string;
  free_works_limit: number;
  price_per_work: number;
  price_per_chapter: number;
  price_currency: string;
  creator_platform_fee_percent: number;
  require_work_review: boolean;
  allow_registration: boolean;
  maintenance_mode: boolean;
  max_upload_mb: number;
  story_ttl_hours: number;
  payment_providers: Record<string, boolean>;
  features: Record<string, boolean>;
};

export default function Settings() {
  const [s, setS] = useState<Settings | null>(null);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    const { data, error } = await supabase.from('app_settings').select('*').eq('id', true).single();
    if (error) setMsg({ kind: 'err', text: error.message });
    else setS(data as Settings);
  }
  useEffect(() => { load(); }, []);

  async function save() {
    if (!s) return;
    setBusy(true);
    try {
      await callAdmin({
        action: 'set_setting',
        patch: {
          app_name: s.app_name,
          default_language: s.default_language,
          publish_policy: s.publish_policy,
          free_works_limit: Number(s.free_works_limit),
          price_per_work: Number(s.price_per_work),
          price_per_chapter: Number(s.price_per_chapter),
          price_currency: s.price_currency,
          creator_platform_fee_percent: Number(s.creator_platform_fee_percent),
          require_work_review: s.require_work_review,
          allow_registration: s.allow_registration,
          maintenance_mode: s.maintenance_mode,
          max_upload_mb: Number(s.max_upload_mb),
          story_ttl_hours: Number(s.story_ttl_hours),
          payment_providers: s.payment_providers,
          features: s.features,
        },
      });
      setMsg({ kind: 'ok', text: 'Settings saved — the app reads these live on next fetch.' });
      load();
    } catch (e) {
      setMsg({ kind: 'err', text: (e as Error).message });
    }
    setBusy(false);
  }

  if (!s) return <div className="card muted">Loading settings…</div>;

  const num = (k: keyof Settings) => ({
    type: 'number' as const,
    value: s[k] as unknown as number,
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setS({ ...s, [k]: Number(e.target.value) }),
  });

  return (
    <>
      <div className="topbar">
        <div>
          <h1>Platform Settings</h1>
          <div className="sub">Publishing policy, pricing, registration and feature flags — all live.</div>
        </div>
        <button className="primary" onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</button>
      </div>

      {msg && <div className={`alert ${msg.kind === 'ok' ? 'ok' : 'err'}`}>{msg.text}</div>}

      <div className="grid c2">
        <div className="card">
          <h2 style={{ marginBottom: 12 }}>Publishing policy</h2>
          <label className="field">
            <span>Policy</span>
            <select value={s.publish_policy} onChange={(e) => setS({ ...s, publish_policy: e.target.value })}>
              <option value="free">free — everyone publishes for free</option>
              <option value="free_quota">free_quota — N free works, then paid</option>
              <option value="always_paid">always_paid — pay per work</option>
              <option value="subscription_only">subscription_only — active plan required</option>
            </select>
          </label>
          <label className="field">
            <span>Free works per account</span>
            <input {...num('free_works_limit')} />
          </label>
          <label className="field">
            <span>Price per work</span>
            <input {...num('price_per_work')} step="0.01" />
          </label>
          <label className="field">
            <span>Price per chapter</span>
            <input {...num('price_per_chapter')} step="0.01" />
          </label>
          <label className="field">
            <span>Creator platform commission (%)</span>
            <input
              type="number"
              min="0"
              max="100"
              step="0.5"
              value={s.creator_platform_fee_percent ?? 15}
              onChange={(e) => setS({ ...s, creator_platform_fee_percent: Number(e.target.value) })}
            />
          </label>
          <p className="muted" style={{ fontSize: 12, lineHeight: 1.6 }}>
            This setting is stored for trusted payment-processing functions. Changing it here does not
            retroactively alter existing creator earnings.
          </p>
          <label className="field">
            <span>Currency</span>
            <select value={s.price_currency} onChange={(e) => setS({ ...s, price_currency: e.target.value })}>
              {['USD', 'EUR', 'GBP', 'AED', 'SAR', 'EGP', 'DZD', 'MAD', 'TND'].map((c) => <option key={c}>{c}</option>)}
            </select>
          </label>
          <label className="row" style={{ fontSize: 13, marginBottom: 8 }}>
            <input type="checkbox" style={{ width: 'auto' }} checked={s.require_work_review}
              onChange={(e) => setS({ ...s, require_work_review: e.target.checked })} />
            Every new work needs editorial review
          </label>
          <p className="muted" style={{ fontSize: 12, lineHeight: 1.6 }}>
            The exact same rule is enforced in the database by <code>can_publish()</code> and the
            <code> guard_work_status</code> trigger — a modified client cannot bypass it.
          </p>
        </div>

        <div className="card">
          <h2 style={{ marginBottom: 12 }}>General</h2>
          <label className="field"><span>App name</span>
            <input value={s.app_name} onChange={(e) => setS({ ...s, app_name: e.target.value })} />
          </label>
          <label className="field"><span>Default language</span>
            <select value={s.default_language} onChange={(e) => setS({ ...s, default_language: e.target.value })}>
              <option value="ar">العربية (RTL)</option>
              <option value="fr">Français</option>
              <option value="en">English</option>
            </select>
          </label>
          <label className="field"><span>Max upload (MB)</span><input {...num('max_upload_mb')} /></label>
          <label className="field"><span>Story lifetime (hours)</span><input {...num('story_ttl_hours')} /></label>
          <label className="row" style={{ fontSize: 13, marginBottom: 8 }}>
            <input type="checkbox" style={{ width: 'auto' }} checked={s.allow_registration}
              onChange={(e) => setS({ ...s, allow_registration: e.target.checked })} /> registration open
          </label>
          <label className="row" style={{ fontSize: 13, marginBottom: 8 }}>
            <input type="checkbox" style={{ width: 'auto' }} checked={s.maintenance_mode}
              onChange={(e) => setS({ ...s, maintenance_mode: e.target.checked })} /> maintenance mode
          </label>
        </div>

        <div className="card">
          <h2 style={{ marginBottom: 12 }}>Payment providers</h2>
          {Object.keys(s.payment_providers).map((k) => (
            <label key={k} className="row" style={{ fontSize: 13, marginBottom: 8 }}>
              <input
                type="checkbox"
                style={{ width: 'auto' }}
                checked={!!s.payment_providers[k]}
                onChange={(e) => setS({ ...s, payment_providers: { ...s.payment_providers, [k]: e.target.checked } })}
              />
              {k}
            </label>
          ))}
          <p className="muted" style={{ fontSize: 12, lineHeight: 1.6, marginTop: 10 }}>
            Toggling a provider hides it in the app checkout. Each provider still needs its own
            secret + webhook URL configured in the edge function environment.
          </p>
        </div>

        <div className="card">
          <h2 style={{ marginBottom: 12 }}>Feature flags</h2>
          {Object.keys(s.features).map((k) => (
            <label key={k} className="row" style={{ fontSize: 13, marginBottom: 8 }}>
              <input
                type="checkbox"
                style={{ width: 'auto' }}
                checked={!!s.features[k]}
                onChange={(e) => setS({ ...s, features: { ...s.features, [k]: e.target.checked } })}
              />
              {k}
            </label>
          ))}
          <button className="primary" style={{ width: '100%', marginTop: 12 }} onClick={save} disabled={busy}>
            {busy ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </div>
    </>
  );
}
