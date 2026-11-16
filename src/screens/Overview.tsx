import { PARTICIPANTS, PERIOD, POOL, PORTFOLIO, ParticipantType, closingBeforeIncome } from '../domain/data';
import { fmt, fmtCompact, fmtPct, sum } from '../domain/money';
import { ALLOC, useApp } from '../state';
import { useRecon } from '../derived';
import { Head, Kpi, Next, ScreenProps } from './common';

export default function Overview({ go }: ScreenProps) {
  const { s } = useApp();
  const recon = useRecon(s);
  const inc = ALLOC.income;
  const closing = sum(PARTICIPANTS.map(closingBeforeIncome)) + inc.net;
  const types = [...new Set(PARTICIPANTS.map((p) => p.type))] as ParticipantType[];

  const steps: Array<[string, boolean]> = [
    ['Intake', true],
    ['Prepared', s.run.status !== 'draft'],
    ['Approved', s.run.status === 'approved'],
    ['Posted to ERP', !!s.allocationAck],
    ['Distributed', s.paymentsReleased],
    ['Reconciled', recon.ties.every((t) => t.status === 'pass')],
    ['Period closed', s.periodClosed],
  ];

  return (
    <>
      <Head
        title={POOL.name}
        lead={`Month-end income allocation for ${PERIOD.label}: from custodian and ledger data, through approval and ERP posting, to a reconciled period and participant statements.`}
      />
      <div className="callout">
        <strong>How to run this demo.</strong> Walk the steps on the left in order. Switch the <em>Acting as</em> user to see
        segregation of duties, the <em>Customer ERP</em> to see the same run post to SAP or Oracle, and the <em>Scenario</em> to
        inject a reconciliation break. <em>Reset demo</em> starts the month over.
      </div>
      <div className="grid g4" style={{ marginBottom: 16 }}>
        <Kpi label="Participants" value={PARTICIPANTS.length} sub={`${types.length} entity types`} />
        <Kpi label="Average daily balance" value={fmtCompact(inc.totalAdb)} sub={`${PERIOD.days}-day month`} />
        <Kpi label="Net income to allocate" value={fmt(inc.net)} sub={`after ${fmt(inc.fee)} admin fee`} />
        <Kpi label="Net yield (annualized)" value={fmtPct(inc.netYieldAnnual, 3)} sub={`${POOL.feeBpsAnnual} bps fee`} />
      </div>
      <div className="panel">
        <h3>Month status</h3>
        <div className="steps">
          {steps.map(([label, ok]) => (
            <span key={label} className={`badge ${ok ? 'ok' : ''}`}>
              {ok ? '✓ ' : ''}
              {label}
            </span>
          ))}
        </div>
      </div>
      <div className="grid g2">
        <div className="panel">
          <h3>Participants by type</h3>
          <table>
            <thead>
              <tr>
                <th>Type</th>
                <th className="num">Count</th>
                <th className="num">Closing balance</th>
              </tr>
            </thead>
            <tbody>
              {types.map((t) => {
                const ps = PARTICIPANTS.filter((p) => p.type === t);
                return (
                  <tr key={t}>
                    <td>{t}</td>
                    <td className="num">{ps.length}</td>
                    <td className="num">{fmtCompact(sum(ps.map(closingBeforeIncome)))}</td>
                  </tr>
                );
              })}
              <tr className="total">
                <td>Pool</td>
                <td className="num">{PARTICIPANTS.length}</td>
                <td className="num">{fmtCompact(closing)}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="panel">
          <h3>Portfolio</h3>
          <table>
            <thead>
              <tr>
                <th>Holding</th>
                <th className="num">Par</th>
                <th className="num">Yield</th>
              </tr>
            </thead>
            <tbody>
              {PORTFOLIO.map((x) => (
                <tr key={x.id}>
                  <td>{x.description}</td>
                  <td className="num">{fmtCompact(x.par)}</td>
                  <td className="num">{x.yieldPct.toFixed(2)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <Next go={go} to="intake" label="Start with intake" />
    </>
  );
}
