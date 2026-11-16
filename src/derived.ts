import { PARTICIPANTS } from './domain/data';
import { bankStatement, ledgerIncome, ledgerLiability } from './domain/ledger';
import { reconcile } from './domain/recon';
import { ALLOC, State, paymentInstructions, subledgerClosing } from './state';

export function useRecon(s: State) {
  const payments = paymentInstructions();
  const result = reconcile({
    alloc: ALLOC,
    ledgerIncome: ledgerIncome(ALLOC.income, s.scenario === 'source'),
    subledgerClosing: subledgerClosing(),
    ledgerLiability: s.allocationAck ? ledgerLiability(s.ledger, PARTICIPANTS) : null,
    distributionPosted: !!s.distributionAck,
    payments,
    bank: s.bankImported ? bankStatement(payments, s.scenario === 'cash') : null,
  });
  const open = result.exceptions.filter((e) => !s.signoffs[e.id]);
  const pending = result.ties.some((t) => t.status === 'pending');
  const canClose = !pending && open.length === 0 && result.ties[1].status === 'pass' && result.ties[2].status === 'pass';
  return { ...result, payments, open, canClose };
}

export const participantName = (id: string) => PARTICIPANTS.find((p) => p.id === id)?.name ?? id;
