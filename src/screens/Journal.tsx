import { Fragment, useState } from 'react';
import { PARTICIPANTS } from '../domain/data';
import { fmt } from '../domain/money';
import { Journal, PROFILES, ProfileId, allocationEvents, buildJournal, distributionEvents } from '../domain/posting';
import { ALLOC, RUN_ID, useApp } from '../state';
import { Head, Next, ScreenProps } from './common';

function JournalTable({ j, profileId, max }: { j: Journal; profileId: ProfileId; max?: number }) {
  const segs = PROFILES[profileId].segmentNames;
  const lines = max ? j.lines.slice(0, max) : j.lines;
  return (
    <div className="scroll">
      <table>
        <thead>
          <tr>
            <th>#</th>
            {segs.map((x) => <th key={x}>{x}</th>)}
            <th className="num">Debit</th>
            <th className="num">Credit</th>
            <th>Text</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((l) => (
            <tr key={l.lineNo}>
              <td>{l.lineNo}</td>
              {segs.map((x) => <td key={x} className="mono">{l.segments[x]}</td>)}
              <td className="num">{l.debit ? fmt(l.debit) : ''}</td>
              <td className="num">{l.credit ? fmt(l.credit) : ''}</td>
              <td className="muted">{l.text}</td>
            </tr>
          ))}
          {max && j.lines.length > max && (
            <tr><td colSpan={segs.length + 4} className="muted">… {j.lines.length - max} more lines</td></tr>
          )}
          <tr className="total">
            <td colSpan={segs.length + 1}>Totals {j.balanced ? '· balanced' : '· OUT OF BALANCE'}</td>
            <td className="num">{fmt(j.totalDebit)}</td>
            <td className="num">{fmt(j.totalCredit)}</td>
            <td />
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export default function JournalScreen({ go }: ScreenProps) {
  const { s, dispatch } = useApp();
  const [kind, setKind] = useState<'allocation' | 'distribution'>('allocation');
  const [compare, setCompare] = useState(false);
  const profile = PROFILES[s.profile];
  const events = kind === 'allocation' ? allocationEvents(ALLOC) : distributionEvents(ALLOC, PARTICIPANTS);
  const j = buildJournal(events, profile, PARTICIPANTS, RUN_ID, kind);
  const ack = kind === 'allocation' ? s.allocationAck : s.distributionAck;
  const approved = s.run.status === 'approved';

  return (
    <>
      <Head
        title="ERP journal"
        lead="The allocation engine emits accounting-neutral events. Posting rules turn them into a balanced journal in the customer's own chart of accounts."
      >
        <div className="row no-print">
          <button className={`btn ${kind === 'allocation' ? '' : 'ghost'}`} onClick={() => setKind('allocation')}>Allocation journal</button>
          <button className={`btn ${kind === 'distribution' ? '' : 'ghost'}`} onClick={() => setKind('distribution')}>Distribution journal</button>
          <button className={`btn ${compare ? '' : 'ghost'}`} onClick={() => setCompare(!compare)}>SAP vs Oracle</button>
        </div>
      </Head>
      {!approved && <div className="callout warn">The run is not approved yet, so the journal can be previewed but not posted.</div>}

      {compare ? (
        <>
          <div className="callout">
            <strong>Same run, two ERPs.</strong> Identical economic events and amounts. Only the posting rules differ: segment
            structure, accounts, document type and interface. Adding a customer on another ERP is configuration, not a rebuild.
          </div>
          {(['sap', 'oracle'] as const).map((pid) => (
            <div className="panel" key={pid}>
              <h3>{PROFILES[pid].label}</h3>
              <JournalTable j={buildJournal(events, PROFILES[pid], PARTICIPANTS, RUN_ID, kind)} profileId={pid} max={8} />
            </div>
          ))}
        </>
      ) : (
        <>
          <div className="grid g2">
            <div className="panel">
              <h3>Header · {profile.label}</h3>
              <dl className="kv">
                {Object.entries(j.header).map(([k, v]) => (
                  <Fragment key={k}><dt>{k}</dt><dd className={k === 'Interface' ? '' : 'mono'}>{v}</dd></Fragment>
                ))}
              </dl>
            </div>
            <div className="panel">
              <h3>Posting</h3>
              {ack ? (
                <div className="callout ok">
                  Posted as <strong className="mono">{ack.docNo}</strong>. Acknowledgement (C9) received.
                </div>
              ) : (
                <p className="muted">Not posted. Batch key <span className="mono">{RUN_ID}/{kind}</span> makes posting idempotent.</p>
              )}
              <div className="row no-print">
                <button
                  className="btn"
                  disabled={!approved || !!ack || (kind === 'distribution' && !s.allocationAck)}
                  onClick={() => dispatch({ type: 'post', kind })}
                >
                  Post to {profile.erp}
                </button>
                {ack && (
                  <button className="btn ghost" onClick={() => dispatch({ type: 'post', kind })}>
                    Resend batch (test idempotency)
                  </button>
                )}
              </div>
              {kind === 'allocation' && ack && !s.distributionAck && (
                <p style={{ marginTop: 10 }}>
                  Next: <a href="#journal" onClick={(e) => { e.preventDefault(); setKind('distribution'); }}>post the distribution journal</a> for cash electors.
                </p>
              )}
            </div>
          </div>
          <div className="panel">
            <h3>{kind === 'allocation' ? 'Allocation' : 'Distribution'} journal lines ({j.lines.length})</h3>
            <JournalTable j={j} profileId={s.profile} />
          </div>
        </>
      )}
      <Next go={go} to="distribution" label="Distribute cash" />
    </>
  );
}
