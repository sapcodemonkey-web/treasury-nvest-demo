import type { ReactNode } from 'react';
import type { ScreenId } from '../App';

export interface ScreenProps {
  go: (id: ScreenId) => void;
}

export function Kpi({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <div className="kpi">
      <div className="label">{label}</div>
      <div className="value">{value}</div>
      {sub && <div className="sub">{sub}</div>}
    </div>
  );
}

export function Head({ title, lead, children }: { title: string; lead: ReactNode; children?: ReactNode }) {
  return (
    <div className="page-head">
      <div className="grow">
        <h1>{title}</h1>
        <p className="muted">{lead}</p>
      </div>
      {children}
    </div>
  );
}

export function Next({ go, to, label }: { go: ScreenProps['go']; to: ScreenId; label: string }) {
  return (
    <div className="row no-print" style={{ justifyContent: 'flex-end', marginTop: 8 }}>
      <button className="btn secondary" onClick={() => go(to)}>
        {label} →
      </button>
    </div>
  );
}

export function StatusBadge({ status }: { status: 'pass' | 'fail' | 'pending' }) {
  const map = { pass: ['ok', 'Ties'], fail: ['warn', 'Break'], pending: ['pend', 'Pending'] } as const;
  return <span className={`badge ${map[status][0]}`}>{map[status][1]}</span>;
}
