// Four-tie reconciliation on canonical data only, identical for every ERP.

import { Cents, sum } from './money';
import { AllocationResult } from './allocation';
import { BankLine, PaymentInstruction } from './ledger';

export type TieStatus = 'pass' | 'fail' | 'pending';

export interface Tie {
  id: 1 | 2 | 3 | 4;
  name: string;
  question: string;
  left: { label: string; value: Cents | null };
  right: { label: string; value: Cents | null };
  status: TieStatus;
  note: string;
}

export interface ReconException {
  id: string;
  tie: number;
  description: string;
  amount: Cents;
}

export interface ReconInput {
  alloc: AllocationResult;
  ledgerIncome: Cents;
  subledgerClosing: Record<string, Cents>;
  ledgerLiability: Record<string, Cents> | null; // null until allocation is posted
  distributionPosted: boolean;
  payments: PaymentInstruction[];
  bank: BankLine[] | null; // null until statement imported
}

export function reconcile(r: ReconInput): { ties: Tie[]; exceptions: ReconException[] } {
  const ex: ReconException[] = [];
  const gross = r.alloc.income.gross;

  const t1: Tie = {
    id: 1,
    name: 'Source tie',
    question: 'Does custodian income match what the ledger booked?',
    left: { label: 'Income summary (C5)', value: gross },
    right: { label: 'Ledger income accounts (C6)', value: r.ledgerIncome },
    status: gross === r.ledgerIncome ? 'pass' : 'fail',
    note: gross === r.ledgerIncome ? 'Intake ties to the books.' : 'Ledger holds income the custodian feed does not.',
  };
  if (t1.status === 'fail')
    ex.push({ id: 'EX-SRC-1', tie: 1, description: 'Ledger income exceeds custodian income summary (late trade adjustment?)', amount: r.ledgerIncome - gross });

  const allocated = sum(r.alloc.lines.map((l) => l.allocated));
  const t2: Tie = {
    id: 2,
    name: 'Allocation tie',
    question: 'Do participant shares plus fee equal gross income, to the cent?',
    left: { label: 'Allocated + fee', value: allocated + r.alloc.income.fee },
    right: { label: 'Gross income', value: gross },
    status: allocated + r.alloc.income.fee === gross ? 'pass' : 'fail',
    note: `${r.alloc.residualCents} residual cent(s) placed by largest remainder.`,
  };

  let t3: Tie;
  if (!r.ledgerLiability) {
    t3 = {
      id: 3,
      name: 'Posting tie',
      question: 'Does the ledger pool liability equal the NVEST participant ledger?',
      left: { label: 'NVEST participant ledger', value: sum(Object.values(r.subledgerClosing)) },
      right: { label: 'ERP pool liability', value: null },
      status: 'pending',
      note: 'Waiting for journal posting acknowledgement.',
    };
  } else {
    const ll = r.ledgerLiability;
    const diffs = Object.keys(r.subledgerClosing).filter((k) => r.subledgerClosing[k] !== ll[k]);
    t3 = {
      id: 3,
      name: 'Posting tie',
      question: 'Does the ledger pool liability equal the NVEST participant ledger?',
      left: { label: 'NVEST participant ledger', value: sum(Object.values(r.subledgerClosing)) },
      right: { label: 'ERP pool liability', value: sum(Object.values(ll)) },
      status: diffs.length === 0 ? 'pass' : r.distributionPosted ? 'fail' : 'pending',
      note:
        diffs.length === 0
          ? 'Every participant ties.'
          : r.distributionPosted
            ? `${diffs.length} participant(s) differ.`
            : 'Allocation posted. Distribution journal not yet posted.',
    };
  }

  let t4: Tie;
  const instructed = sum(r.payments.map((p) => p.amount));
  if (!r.bank) {
    t4 = {
      id: 4,
      name: 'Cash tie',
      question: 'Did the bank pay exactly what NVEST instructed?',
      left: { label: 'Payment instructions (C8)', value: instructed },
      right: { label: 'Bank cleared debits (C10)', value: null },
      status: 'pending',
      note: 'Waiting for bank statement.',
    };
  } else {
    const cleared = sum(r.bank.map((b) => b.amount));
    for (const p of r.payments) {
      const b = r.bank.find((x) => x.ref === p.id);
      if (!b) ex.push({ id: `EX-CASH-${p.id}`, tie: 4, description: `${p.id} not cleared by bank (returned item)`, amount: p.amount });
      else if (b.amount !== p.amount)
        ex.push({ id: `EX-CASH-${p.id}`, tie: 4, description: `${p.id} cleared for a different amount`, amount: p.amount - b.amount });
    }
    t4 = {
      id: 4,
      name: 'Cash tie',
      question: 'Did the bank pay exactly what NVEST instructed?',
      left: { label: 'Payment instructions (C8)', value: instructed },
      right: { label: 'Bank cleared debits (C10)', value: cleared },
      status: instructed === cleared && ex.every((e) => e.tie !== 4) ? 'pass' : 'fail',
      note: instructed === cleared ? 'All payments matched by reference and amount.' : 'Unmatched items in exceptions queue.',
    };
  }
  return { ties: [t1, t2, t3, t4], exceptions: ex };
}
