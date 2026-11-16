import { PARTICIPANTS, PORTFOLIO, closingBeforeIncome } from '../domain/data';
import { fmt, fmtPct, sum } from '../domain/money';
import { allocate } from '../domain/allocation';
import { sha256, shortHash } from '../domain/hash';
import { ALLOC, useApp } from '../state';
import { Head, Next, ScreenProps } from './common';

export default function Allocation({ go }: ScreenProps) {
  const { s, dispatch } = useApp();
  const inc = ALLOC.income;

  const prepare = async () => {
    const inputHash = await sha256({ participants: PARTICIPANTS, portfolio: PORTFOLIO, method: 'ADB-v1' });
    const outputHash = await sha256(allocate(PARTICIPANTS, PORTFOLIO));
    dispatch({ type: 'prepare', inputHash, outputHash });
  };

  return (
    <>
      <Head
        title="Allocation"
        lead={`Net income of ${fmt(inc.net)} is shared by average daily balance. Each participant earns for exactly the days its money was in the pool.`}
      >
        <div className="row no-print">
          {s.run.status === 'draft' ? (
            <button className="btn" onClick={prepare}>Prepare run</button>
          ) : (
            <span className="badge ok">Prepared · outputs {shortHash(s.run.outputHash ?? '')}</span>
          )}
        </div>
      </Head>
      <div className="callout">
        <strong>Exact to the cent.</strong> Shares are rounded down, then the {ALLOC.residualCents} leftover cents go to the
        participants with the largest remainders (marked ¢). Allocations always sum to net income. Rows highlighted in yellow are the
        month's edge cases: a participant that joined on the 12th and one that withdrew everything on the 20th.
      </div>
      <div className="panel">
        <div className="scroll">
          <table>
            <thead>
              <tr>
                <th>Participant</th>
                <th>Type</th>
                <th>Election</th>
                <th className="num">Opening</th>
                <th className="num">Net flows</th>
                <th className="num">Avg daily balance</th>
                <th className="num">Share</th>
                <th className="num">Income allocated</th>
              </tr>
            </thead>
            <tbody>
              {PARTICIPANTS.map((p) => {
                const l = ALLOC.lines.find((x) => x.participantId === p.id)!;
                const flows = sum(p.flows.map((f) => f.amount));
                const edge = p.opening === 0 || closingBeforeIncome(p) === 0;
                return (
                  <tr key={p.id} className={edge ? 'hl' : ''}>
                    <td>
                      {p.name}
                      {edge && (
                        <div className="muted" style={{ fontSize: 12 }}>
                          {p.opening === 0 ? `Joined day ${p.flows[0]?.day}` : `Exited day ${p.flows.at(-1)?.day}`}
                        </div>
                      )}
                    </td>
                    <td>{p.type}</td>
                    <td><span className={`badge ${p.election === 'cash' ? 'brand' : ''}`}>{p.election}</span></td>
                    <td className="num">{fmt(p.opening)}</td>
                    <td className="num">{flows ? fmt(flows) : '—'}</td>
                    <td className="num">{fmt(l.adb)}</td>
                    <td className="num">{fmtPct(l.share, 4)}</td>
                    <td className="num">
                      {fmt(l.allocated)} {l.roundingCent && <span title="Received one residual cent">¢</span>}
                    </td>
                  </tr>
                );
              })}
              <tr className="total">
                <td colSpan={5}>Total</td>
                <td className="num">{fmt(inc.totalAdb)}</td>
                <td className="num">100.0000%</td>
                <td className="num">{fmt(sum(ALLOC.lines.map((l) => l.allocated)))}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      <Next go={go} to="approval" label="Send for approval" />
    </>
  );
}
