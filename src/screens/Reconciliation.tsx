import { useState } from 'react';
import { fmt } from '../domain/money';
import { useApp } from '../state';
import { useRecon } from '../derived';
import { Head, Next, ScreenProps, StatusBadge } from './common';

const REASONS = [
  'Returned item reissued to corrected account; follow-up PMT logged',
  'Bank fee netted in error; bank claim filed, difference recoverable',
  'Late trade adjustment confirmed; custodian feed corrected for next period',
  'Timing difference; clears next business day',
];

export default function Reconciliation({ go }: ScreenProps) {
  const { s, dispatch } = useApp();
  const { ties, exceptions, open, canClose } = useRecon(s);
  const [reason, setReason] = useState<Record<string, string>>({});

  return (
    <>
      <Head
        title="Reconciliation"
        lead="Four ties, run on canonical data, the same for every ERP. The period can't close until every tie holds or every break has a named sign-off."
      >
        <div className="row no-print">
          <button className="btn" disabled={!canClose || s.periodClosed} onClick={() => dispatch({ type: 'closePeriod' })}>
            {s.periodClosed ? 'Period closed' : 'Close period'}
          </button>
        </div>
      </Head>
      {s.user !== 'reconciler' && open.length > 0 && (
        <div className="callout">Switch <em>Acting as</em> to Sam Ortiz (Reconciler) to sign off exceptions and close the period.</div>
      )}
      <div className="grid g2" style={{ marginBottom: 16 }}>
        {ties.map((t) => (
          <div key={t.id} className={`tie ${t.status}`}>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <h3 style={{ margin: 0 }}>{t.id}. {t.name}</h3>
              {t.status === 'fail' && exceptions.filter((e) => e.tie === t.id).every((e) => s.signoffs[e.id]) &&
              exceptions.some((e) => e.tie === t.id) ? (
                <span className="badge brand">Break · signed off</span>
              ) : (
                <StatusBadge status={t.status} />
              )}
            </div>
            <div className="muted" style={{ fontSize: 13 }}>{t.question}</div>
            <div className="vals">
              <div><div className="l">{t.left.label}</div><div className="num" style={{ textAlign: 'left' }}>{t.left.value === null ? '—' : fmt(t.left.value)}</div></div>
              <div><div className="l">{t.right.label}</div><div className="num" style={{ textAlign: 'left' }}>{t.right.value === null ? '—' : fmt(t.right.value)}</div></div>
            </div>
            <div style={{ fontSize: 12.5 }}>{t.note}</div>
          </div>
        ))}
      </div>
      <div className="panel">
        <h3>Exceptions queue</h3>
        {exceptions.length === 0 ? (
          <p className="muted">No exceptions.</p>
        ) : (
          <table>
            <thead>
              <tr><th>ID</th><th>Tie</th><th>Description</th><th className="num">Amount</th><th>Sign-off</th></tr>
            </thead>
            <tbody>
              {exceptions.map((e) => {
                const so = s.signoffs[e.id];
                return (
                  <tr key={e.id}>
                    <td className="mono">{e.id}</td>
                    <td>{e.tie}</td>
                    <td>{e.description}</td>
                    <td className="num">{fmt(e.amount)}</td>
                    <td style={{ minWidth: 300 }}>
                      {so ? (
                        <span><span className="badge ok">Signed</span> {so.by}: {so.reason}</span>
                      ) : (
                        <div className="row no-print">
                          <select value={reason[e.id] ?? ''} onChange={(ev) => setReason({ ...reason, [e.id]: ev.target.value })}>
                            <option value="">Choose resolution…</option>
                            {REASONS.map((r) => <option key={r}>{r}</option>)}
                          </select>
                          <button
                            className="btn"
                            disabled={!reason[e.id]}
                            onClick={() => dispatch({ type: 'signoff', id: e.id, reason: reason[e.id] })}
                          >
                            Sign off
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
      <Next go={go} to="statements" label="Participant statements" />
    </>
  );
}
