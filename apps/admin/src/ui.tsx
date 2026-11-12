import React from 'react';

export const Logo = ({ size = 34 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 64 64" fill="none" aria-label="SARAD">
    <defs>
      <linearGradient id="lg" x1="0" y1="0" x2="64" y2="64">
        <stop offset="0%" stopColor="#E3C463" />
        <stop offset="100%" stopColor="#A47F14" />
      </linearGradient>
    </defs>
    <circle cx="32" cy="32" r="30" stroke="url(#lg)" strokeWidth="1.6" opacity="0.75" />
    <path d="M20 40c0-9 5-16 12-16s12 7 12 16" stroke="url(#lg)" strokeWidth="1.4" opacity="0.45" fill="none" />
    <path
      d="M21 23c4-3 8-4 11-4 4 0 7 1 11 4-4 0-7 1-11 3-4-2-7-3-11-3Z"
      fill="url(#lg)"
    />
    <path d="M32 26v14" stroke="url(#lg)" strokeWidth="1.6" />
    <circle cx="32" cy="19" r="1.6" fill="#E3C463" />
  </svg>
);

export function StatusBadge({ value }: { value: string }) {
  const map: Record<string, string> = {
    published: 'ok', succeeded: 'ok', active: 'ok', approved: 'ok', accepted: 'ok', resolved: 'ok',
    pending: 'warn', pending_review: 'warn', reviewing: 'warn', requires_action: 'warn', trialing: 'warn',
    failed: 'bad', rejected: 'bad', banned: 'bad', canceled: 'bad', open: 'bad', draft: '',
  };
  return <span className={`badge ${map[value] ?? ''}`}>{value.replace(/_/g, ' ')}</span>;
}

export function Table({ head, children }: { head: string[]; children: React.ReactNode }) {
  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      <table>
        <thead>
          <tr>{head.map((h) => <th key={h}>{h}</th>)}</tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export function Empty({ text }: { text: string }) {
  return <div className="card" style={{ textAlign: 'center', color: 'var(--muted)', padding: 36 }}>{text}</div>;
}
