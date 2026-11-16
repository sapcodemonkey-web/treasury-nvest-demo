import { useState } from 'react';
import { PARTICIPANTS, PERIOD, POOL } from '../domain/data';
import { fmt, fmtPct, sum } from '../domain/money';
import { ALLOC, useApp } from '../state';
import { Head, ScreenProps, Next } from './common';

export default function Statements({ go }: ScreenProps) {
  const { s } = useApp();
  const [pid, setPid] = useState(PARTICIPANTS[4].id);
  const p = PARTICIPANTS.find((x) => x.id === pid)!;
  const l = ALLOC.lines.find((x) => x.participantId === pid)!;
  const deposits = sum(p.flows.filter((f) => f.amount > 0).map((f) => f.amount));
  const withdrawals = sum(p.flows.filter((f) => f.amount < 0).map((f) => f.amount));
  const paid = p.election === 'cash' ? l.allocated : 0;
  const closing = p.opening + deposits + withdrawals + l.allocated - paid;

  return (
    <>
      <Head title="Participant statements" lead="What each participant receives at month end. Pool administrators sell to these readers.">
        <div className="row no-print">
          <select value={pid} onChange={(e) => setPid(e.target.value)} style={{ padding: 6 }}>
            {PARTICIPANTS.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
          </select>
          <button className="btn ghost" onClick={() => window.print()}>Print / PDF</button>
        </div>
      </Head>
      {!s.periodClosed && <div className="callout warn">Draft. Statements are released when the period closes.</div>}
      <div className="panel statement">
        <div className="head">
          <div>
            <h2>{p.name}</h2>
            <div className="muted">Account {p.externalKey} · {p.type}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <strong>{POOL.name}</strong>
            <div className="muted">Statement for {PERIOD.label}</div>
          </div>
        </div>
        <table>
          <tbody>
            <tr><td>Opening balance, Oct 1</td><td className="num">{fmt(p.opening)}</td></tr>
            <tr><td>Deposits</td><td className="num">{fmt(deposits)}</td></tr>
            <tr><td>Withdrawals</td><td className="num">{fmt(withdrawals)}</td></tr>
            <tr><td>Income earned (net of fees)</td><td className="num">{fmt(l.allocated)}</td></tr>
            <tr>
              <td>Income {p.election === 'cash' ? 'paid in cash, value Nov 3' : 'reinvested'}</td>
              <td className="num">{p.election === 'cash' ? `(${fmt(paid)})` : '—'}</td>
            </tr>
            <tr className="total"><td>Closing balance, Oct 31</td><td className="num">{fmt(closing)}</td></tr>
          </tbody>
        </table>
        <div className="grid g3" style={{ marginTop: 16 }}>
          <div className="kpi"><div className="label">Average daily balance</div><div className="value">{fmt(l.adb)}</div></div>
          <div className="kpi"><div className="label">Share of pool</div><div className="value">{fmtPct(l.share, 3)}</div></div>
          <div className="kpi"><div className="label">Net yield, annualized</div><div className="value">{fmtPct(ALLOC.income.netYieldAnnual, 3)}</div></div>
        </div>
        <p className="muted" style={{ marginTop: 14, fontSize: 12 }}>
          Income is allocated by average daily balance after a {POOL.feeBpsAnnual} basis point annual administration fee. Run
          RUN-2026-10-001, approved and reconciled. Fictional data for demonstration.
        </p>
      </div>
      <Next go={go} to="audit" label="Audit trail & replay" />
    </>
  );
}
