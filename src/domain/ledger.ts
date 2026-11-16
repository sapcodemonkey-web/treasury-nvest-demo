// Simulated customer systems: an ERP general ledger and a bank. Stand-ins for the adapters.
// Idempotent by batch key: resending a posted batch returns the existing document.

import { Cents, sum } from './money';
import { Journal } from './posting';
import { Participant } from './data';
import { IncomeSummary } from './allocation';

export interface LedgerDoc {
  docNo: string;
  key: string; // idempotency key = run id + kind
  kind: 'allocation' | 'distribution';
  erp: string;
  postedAt: string;
  totalDebit: Cents;
  /** net credit to the pool liability per participant (credit positive) */
  liabilityByParticipant: Record<string, Cents>;
  payableByParticipant: Record<string, Cents>;
  reversed?: boolean;
}

export interface LedgerState {
  docs: LedgerDoc[];
  nextNo: number;
}

export const emptyLedger = (): LedgerState => ({ docs: [], nextNo: 4417 });

export interface PostingAck {
  status: 'posted' | 'duplicate' | 'rejected';
  docNo?: string;
  message: string;
}

export function postJournal(
  ledger: LedgerState,
  journal: Journal,
  key: string,
  kind: 'allocation' | 'distribution',
  erp: string,
  liabilityAccounts: string[],
  payableAccounts: string[],
): { ledger: LedgerState; ack: PostingAck } {
  const existing = ledger.docs.find((d) => d.key === key && !d.reversed);
  if (existing)
    return {
      ledger,
      ack: { status: 'duplicate', docNo: existing.docNo, message: `Batch ${key} already posted as ${existing.docNo}. No new document created.` },
    };
  if (!journal.balanced)
    return { ledger, ack: { status: 'rejected', message: 'Journal does not balance. Nothing posted.' } };

  const liab: Record<string, Cents> = {};
  const pay: Record<string, Cents> = {};
  for (const l of journal.lines) {
    if (!l.participantId) continue;
    const accts = Object.values(l.segments);
    if (accts.some((a) => liabilityAccounts.includes(a)))
      liab[l.participantId] = (liab[l.participantId] ?? 0) + l.credit - l.debit;
    if (accts.some((a) => payableAccounts.includes(a)))
      pay[l.participantId] = (pay[l.participantId] ?? 0) + l.credit - l.debit;
  }
  const docNo = erp === 'SAP' ? `19${String(ledger.nextNo).padStart(8, '0')}` : `JE-OCT26-${String(ledger.nextNo).padStart(6, '0')}`;
  const doc: LedgerDoc = {
    docNo,
    key,
    kind,
    erp,
    postedAt: new Date().toISOString(),
    totalDebit: journal.totalDebit,
    liabilityByParticipant: liab,
    payableByParticipant: pay,
  };
  return {
    ledger: { docs: [...ledger.docs, doc], nextNo: ledger.nextNo + 1 },
    ack: { status: 'posted', docNo, message: `Posted ${journal.lines.length} lines as ${docNo}.` },
  };
}

/** Ledger-side income for the period (what the treasury module booked). */
export function ledgerIncome(income: IncomeSummary, sourceBreak: boolean): Cents {
  // A late trade adjustment booked in the ERP but missing from the custodian feed.
  return income.gross + (sourceBreak ? 125_000 : 0);
}

/** Pool liability per participant in the ledger after postings. */
export function ledgerLiability(ledger: LedgerState, participants: Participant[]): Record<string, Cents> {
  const out: Record<string, Cents> = {};
  for (const p of participants) out[p.id] = p.opening + sum(p.flows.map((f) => f.amount));
  for (const d of ledger.docs) {
    if (d.reversed) continue;
    for (const [pid, amt] of Object.entries(d.liabilityByParticipant)) out[pid] = (out[pid] ?? 0) + amt;
  }
  return out;
}

export interface PaymentInstruction {
  id: string;
  participantId: string;
  payeeKey: string;
  amount: Cents;
  valueDate: string;
}

export interface BankLine {
  ref: string;
  amount: Cents; // debit, positive
  description: string;
}

/** camt.053-style cleared debits for the payment run. */
export function bankStatement(payments: PaymentInstruction[], cashBreak: boolean): BankLine[] {
  return payments.flatMap((p, i) => {
    if (cashBreak && i === 1) return []; // returned: invalid beneficiary account
    const amount = cashBreak && i === 3 ? p.amount - 2_500 : p.amount; // bank fee netted by mistake
    return [{ ref: p.id, amount, description: `ACH CREDIT ${p.payeeKey}` }];
  });
}
