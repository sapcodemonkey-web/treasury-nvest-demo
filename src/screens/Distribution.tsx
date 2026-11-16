import { PARTICIPANTS } from '../domain/data';
import { fmt, sum } from '../domain/money';
import { bankStatement } from '../domain/ledger';
import { useApp } from '../state';
import { participantName, useRecon } from '../derived';
import { Head, Next, ScreenProps } from './common';

export default function Distribution({ go }: ScreenProps) {
  const { s, dispatch } = useApp();
  const { payments } = useRecon(s);
  const bank = s.bankImported ? bankStatement(payments, s.scenario === 'cash') : [];
  const reinvest = PARTICIPANTS.filter((p) => p.election === 'reinvest').length;

  return (
    <>
      <Head
        title="Distribution"
        lead={`${payments.length} participants elected cash; ${reinvest} reinvest, so their income stays in the pool. NVEST issues instructions. The ERP pays. NVEST never holds bank account numbers.`}
      >
        <div className="row no-print">
          <button className="btn" disabled={!s.distributionAck || s.paymentsReleased} onClick={() => dispatch({ type: 'releasePayments' })}>
            Release to ERP payment run
          </button>
          <button className="btn secondary" disabled={!s.paymentsReleased || s.bankImported} onClick={() => dispatch({ type: 'importBank' })}>
            Import bank statement
          </button>
        </div>
      </Head>
      {!s.distributionAck && (
        <div className="callout warn">Post the distribution journal on the ERP journal step before releasing payments.</div>
      )}
      <div className="panel">
        <h3>Payment instructions (C8)</h3>
        <table>
          <thead>
            <tr>
              <th>Instruction</th>
              <th>Participant</th>
              <th>Payee key (ERP)</th>
              <th>Value date</th>
              <th className="num">Amount</th>
              <th>Bank status</th>
            </tr>
          </thead>
          <tbody>
            {payments.map((p) => {
              const b = bank.find((x) => x.ref === p.id);
              const status = !s.bankImported ? (s.paymentsReleased ? 'Released' : 'Ready') : !b ? 'Returned' : b.amount !== p.amount ? `Cleared ${fmt(b.amount)}` : 'Cleared';
              const cls = status === 'Cleared' ? 'ok' : status === 'Released' ? 'brand' : status === 'Ready' ? '' : 'warn';
              return (
                <tr key={p.id}>
                  <td className="mono">{p.id}</td>
                  <td>{participantName(p.participantId)}</td>
                  <td className="mono">{p.payeeKey}</td>
                  <td>{p.valueDate}</td>
                  <td className="num">{fmt(p.amount)}</td>
                  <td><span className={`badge ${cls}`}>{status}</span></td>
                </tr>
              );
            })}
            <tr className="total">
              <td colSpan={4}>Total cash distribution</td>
              <td className="num">{fmt(sum(payments.map((p) => p.amount)))}</td>
              <td />
            </tr>
          </tbody>
        </table>
      </div>
      <Next go={go} to="recon" label="Reconcile the month" />
    </>
  );
}
