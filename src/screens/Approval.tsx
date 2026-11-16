import { USERS } from '../domain/data';
import { fmt } from '../domain/money';
import { shortHash } from '../domain/hash';
import { ALLOC, RUN_ID, useApp } from '../state';
import { Head, Next, ScreenProps } from './common';

const STAGES = ['draft', 'prepared', 'submitted', 'approved'] as const;

export default function Approval({ go }: ScreenProps) {
  const { s, dispatch } = useApp();
  const idx = STAGES.indexOf(s.run.status);
  const me = USERS.find((u) => u.id === s.user)!;

  return (
    <>
      <Head
        title="Maker / checker approval"
        lead="The run is frozen and fingerprinted when submitted. A different person must approve it. Nothing reaches the ledger without approval."
      />
      <div className="callout">
        <strong>Try it:</strong> submit as Pat Reyes (Preparer), then press Approve while still signed in as Pat. The refusal is
        logged. Switch <em>Acting as</em> to Jordan Lee (Approver) to approve.
      </div>
      <div className="panel">
        <div className="row" style={{ marginBottom: 12 }}>
          {STAGES.map((st, i) => (
            <span key={st} className={`badge ${i <= idx ? 'ok' : ''}`}>
              {i <= idx ? '✓ ' : ''}
              {st[0].toUpperCase() + st.slice(1)}
            </span>
          ))}
        </div>
        <dl className="kv">
          <dt>Run</dt><dd className="mono">{RUN_ID}</dd>
          <dt>Net income allocated</dt><dd>{fmt(ALLOC.income.net)} to {ALLOC.lines.length} participants</dd>
          <dt>Prepared by</dt><dd>{s.run.preparedBy ?? '—'}</dd>
          <dt>Approved by</dt><dd>{s.run.approvedBy ?? '—'}</dd>
          <dt>Input fingerprint</dt><dd className="mono">{shortHash(s.run.inputHash ?? '')}</dd>
          <dt>Output fingerprint</dt><dd className="mono">{shortHash(s.run.outputHash ?? '')}</dd>
          <dt>You are</dt><dd>{me.name} · {me.role}</dd>
        </dl>
        <div className="row no-print" style={{ marginTop: 14 }}>
          {s.run.status === 'draft' && (
            <button className="btn secondary" onClick={() => go('allocation')}>Prepare the run first</button>
          )}
          <button className="btn" disabled={s.run.status !== 'prepared'} onClick={() => dispatch({ type: 'submit' })}>
            Submit for approval
          </button>
          <button className="btn" disabled={s.run.status !== 'submitted'} onClick={() => dispatch({ type: 'approve' })}>
            Approve run
          </button>
        </div>
      </div>
      <Next go={go} to="journal" label="Post to the ERP" />
    </>
  );
}
