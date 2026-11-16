import { PARTICIPANTS, PERIOD, PORTFOLIO } from '../domain/data';
import { fmt, sum } from '../domain/money';
import { ledgerIncome } from '../domain/ledger';
import { ALLOC, useApp } from '../state';
import { Head, Next, ScreenProps } from './common';

const MESSAGES = [
  ['C1', 'PartyMaster', 'ERP', 'In'],
  ['C2', 'AccountingCalendar', 'ERP', 'In'],
  ['C3', 'AccountMap', 'ERP', 'In'],
  ['C4', 'PositionSnapshot', 'Custodian', 'In'],
  ['C5', 'IncomeSummary', 'Custodian', 'In'],
  ['C6', 'LedgerBalance', 'ERP', 'In'],
  ['C7', 'JournalRequest', 'NVEST', 'Out'],
  ['C8', 'PaymentInstruction', 'NVEST', 'Out'],
  ['C9', 'PostingAcknowledgement', 'ERP', 'In'],
  ['C10', 'CashStatement', 'Bank', 'In'],
];

export default function Intake({ go }: ScreenProps) {
  const { s } = useApp();
  const inc = ALLOC.income;
  const ledger = ledgerIncome(inc, s.scenario === 'source');
  const sourceOk = ledger === inc.gross;

  const checks: Array<[string, string, boolean]> = [
    ['Participants resolved', `${PARTICIPANTS.length} of ${PARTICIPANTS.length} map to an active ERP party key`, true],
    ['Source period closed', `${PERIOD.label} (${PERIOD.fiscalYear} P${PERIOD.fiscalPeriod}) shows closed in the ERP calendar`, true],
    ['Positions loaded', `${PORTFOLIO.length} holdings, par ${fmt(sum(PORTFOLIO.map((x) => x.par)))}, control total and hash verified`, true],
    ['Income summary loaded', `Gross income ${fmt(inc.gross)} across 3 income types`, true],
    [
      'Income ties to ledger',
      sourceOk ? `Ledger income accounts = ${fmt(ledger)}` : `Ledger shows ${fmt(ledger)}, custodian ${fmt(inc.gross)}: difference ${fmt(ledger - inc.gross)}`,
      sourceOk,
    ],
    ['Fee rule', '5 bps annual on average daily balance, approved rule set v3', true],
  ];

  return (
    <>
      <Head
        title="Intake & readiness"
        lead="Before anything is calculated, NVEST proves its inputs match the customer's books. A run cannot start against an open period or untied data."
      />
      {!sourceOk && (
        <div className="callout warn">
          <strong>Source break injected.</strong> The ERP booked a late trade adjustment that the custodian feed doesn't have. In
          production this would block the run. Here it carries through to reconciliation so you can see it caught there.
        </div>
      )}
      <div className="panel">
        <h3>Readiness checks</h3>
        <table>
          <tbody>
            {checks.map(([name, detail, ok]) => (
              <tr key={name}>
                <td style={{ width: 28 }}>{ok ? '✅' : '⚠️'}</td>
                <td style={{ width: 220, fontWeight: 600 }}>{name}</td>
                <td>{detail}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="grid g2">
        <div className="panel">
          <h3>Income summary (C5)</h3>
          <table>
            <tbody>
              <tr><td>Interest</td><td className="num">{fmt(inc.interest)}</td></tr>
              <tr><td>Discount accretion, net of premium amortization</td><td className="num">{fmt(inc.accretion)}</td></tr>
              <tr><td>Realized gains / losses</td><td className="num">{fmt(inc.realizedGL)}</td></tr>
              <tr className="total"><td>Gross income</td><td className="num">{fmt(inc.gross)}</td></tr>
              <tr><td>Administration fee</td><td className="num">({fmt(inc.fee)})</td></tr>
              <tr className="total"><td>Net income to allocate</td><td className="num">{fmt(inc.net)}</td></tr>
            </tbody>
          </table>
        </div>
        <div className="panel">
          <h3>Canonical messages</h3>
          <p className="muted">Ten ERP-neutral messages. Each customer's ERP, custodian and bank plug in behind them.</p>
          <table>
            <thead>
              <tr><th>#</th><th>Message</th><th>From</th><th>Dir</th><th>This month</th></tr>
            </thead>
            <tbody>
              {MESSAGES.map(([id, name, from, dir]) => {
                const status =
                  id === 'C7' ? (s.allocationAck ? 'Sent' : 'Waiting')
                  : id === 'C8' ? (s.paymentsReleased ? 'Sent' : 'Waiting')
                  : id === 'C9' ? (s.allocationAck ? 'Received' : 'Waiting')
                  : id === 'C10' ? (s.bankImported ? 'Received' : 'Waiting')
                  : 'Received';
                return (
                  <tr key={id}>
                    <td className="mono">{id}</td>
                    <td>{name}</td>
                    <td>{from}</td>
                    <td>{dir}</td>
                    <td><span className={`badge ${status === 'Waiting' ? '' : 'ok'}`}>{status}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      <Next go={go} to="allocation" label="Calculate the allocation" />
    </>
  );
}
