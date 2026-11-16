import { useState } from 'react';
import { PARTICIPANTS, PORTFOLIO } from '../domain/data';
import { allocate } from '../domain/allocation';
import { sha256, shortHash } from '../domain/hash';
import { useApp } from '../state';
import { Head, ScreenProps } from './common';

export default function Audit(_: ScreenProps) {
  const { s, dispatch } = useApp();
  const [replay, setReplay] = useState<{ hash: string; match: boolean } | null>(null);

  const run = async () => {
    const hash = await sha256(allocate(PARTICIPANTS, PORTFOLIO));
    const match = hash === s.run.outputHash;
    setReplay({ hash, match });
    dispatch({
      type: 'log',
      entry: {
        user: 'Auditor',
        action: 'Replay executed',
        detail: `Recomputed from stored inputs: ${hash.slice(0, 12)}… ${match ? 'matches' : 'does NOT match'} the approved output.`,
        kind: match ? 'ok' : 'warn',
      },
    });
  };

  return (
    <>
      <Head
        title="Audit trail & replay"
        lead="Every action, refusal and posting is logged with who did it. Any approved run can be recomputed from its stored inputs and must reproduce the same fingerprint."
      />
      <div className="panel">
        <h3>Replay</h3>
        {!s.run.outputHash ? (
          <p className="muted">Prepare a run first. Replay compares against the fingerprint taken at preparation.</p>
        ) : (
          <>
            <dl className="kv">
              <dt>Approved output</dt><dd className="mono">{shortHash(s.run.outputHash)}</dd>
              <dt>Replayed output</dt><dd className="mono">{replay ? shortHash(replay.hash) : '—'}</dd>
            </dl>
            <div className="row" style={{ marginTop: 10 }}>
              <button className="btn" onClick={run}>Replay run from stored inputs</button>
              {replay && (
                <span className={`badge ${replay.match ? 'ok' : 'warn'}`}>
                  {replay.match ? 'Identical to the cent' : 'Mismatch'}
                </span>
              )}
            </div>
          </>
        )}
      </div>
      <div className="panel">
        <h3>Audit log ({s.audit.length})</h3>
        <div className="scroll">
          <table>
            <thead>
              <tr><th>Time</th><th>User</th><th>Action</th><th>Detail</th></tr>
            </thead>
            <tbody>
              {[...s.audit].reverse().map((e, i) => (
                <tr key={i}>
                  <td className="mono">{new Date(e.at).toLocaleTimeString()}</td>
                  <td>{e.user}</td>
                  <td>
                    <span className={`badge ${e.kind === 'ok' ? 'ok' : e.kind === 'warn' ? 'warn' : ''}`}>{e.action}</span>
                  </td>
                  <td>{e.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
