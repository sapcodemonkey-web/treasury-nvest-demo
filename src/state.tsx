import { createContext, ReactNode, useContext, useEffect, useReducer } from 'react';
import { PARTICIPANTS, PORTFOLIO, USERS, UserId, closingBeforeIncome } from './domain/data';
import { allocate } from './domain/allocation';
import { Cents } from './domain/money';
import {
  LedgerState,
  PaymentInstruction,
  PostingAck,
  emptyLedger,
  postJournal,
} from './domain/ledger';
import { PROFILES, ProfileId, allocationEvents, buildJournal, distributionEvents } from './domain/posting';

export const ALLOC = allocate(PARTICIPANTS, PORTFOLIO);
export const RUN_ID = 'RUN-2026-10-001';

export type BreakScenario = 'none' | 'cash' | 'source';
export type RunStatus = 'draft' | 'prepared' | 'submitted' | 'approved';

export interface AuditEntry {
  at: string;
  user: string;
  action: string;
  detail: string;
  kind: 'info' | 'ok' | 'warn';
}

export interface Signoff {
  by: string;
  reason: string;
  at: string;
}

export interface State {
  user: UserId;
  profile: ProfileId;
  scenario: BreakScenario;
  run: {
    status: RunStatus;
    preparedBy?: string;
    approvedBy?: string;
    inputHash?: string;
    outputHash?: string;
  };
  ledger: LedgerState;
  allocationAck?: PostingAck;
  distributionAck?: PostingAck;
  paymentsReleased: boolean;
  bankImported: boolean;
  signoffs: Record<string, Signoff>;
  periodClosed: boolean;
  audit: AuditEntry[];
  toast?: { kind: 'ok' | 'warn' | 'info'; text: string };
}

const initial = (): State => ({
  user: 'preparer',
  profile: 'sap',
  scenario: 'cash',
  run: { status: 'draft' },
  ledger: emptyLedger(),
  paymentsReleased: false,
  bankImported: false,
  signoffs: {},
  periodClosed: false,
  audit: [
    {
      at: new Date().toISOString(),
      user: 'System',
      action: 'Period intake loaded',
      detail: 'C1 PartyMaster, C2 Calendar, C4 Positions, C5 Income, C6 Ledger balances received for October 2026.',
      kind: 'info',
    },
  ],
});

export type Action =
  | { type: 'setUser'; user: UserId }
  | { type: 'setProfile'; profile: ProfileId }
  | { type: 'setScenario'; scenario: BreakScenario }
  | { type: 'prepare'; inputHash: string; outputHash: string }
  | { type: 'submit' }
  | { type: 'approve' }
  | { type: 'post'; kind: 'allocation' | 'distribution' }
  | { type: 'releasePayments' }
  | { type: 'importBank' }
  | { type: 'signoff'; id: string; reason: string }
  | { type: 'closePeriod' }
  | { type: 'log'; entry: Omit<AuditEntry, 'at'> }
  | { type: 'dismissToast' }
  | { type: 'reset' };

const userName = (id: UserId) => USERS.find((u) => u.id === id)!.name;
const userRole = (id: UserId) => USERS.find((u) => u.id === id)!.role;

function audit(s: State, action: string, detail: string, kind: AuditEntry['kind'] = 'info', who?: string): AuditEntry[] {
  return [...s.audit, { at: new Date().toISOString(), user: who ?? `${userName(s.user)} (${userRole(s.user)})`, action, detail, kind }];
}

function refuse(s: State, action: string, why: string): State {
  return { ...s, audit: audit(s, `Refused: ${action}`, why, 'warn'), toast: { kind: 'warn', text: why } };
}

export function paymentInstructions(): PaymentInstruction[] {
  return distributionEvents(ALLOC, PARTICIPANTS).map((e, i) => {
    const p = PARTICIPANTS.find((x) => x.id === e.participantId)!;
    return {
      id: `PMT-${String(i + 1).padStart(4, '0')}`,
      participantId: p.id,
      payeeKey: p.externalKey,
      amount: e.amount,
      valueDate: '2026-11-03',
    };
  });
}

/** NVEST participant ledger closing balance after income and cash distribution. */
export function subledgerClosing(): Record<string, Cents> {
  const out: Record<string, Cents> = {};
  for (const p of PARTICIPANTS) {
    const a = ALLOC.lines.find((l) => l.participantId === p.id)!.allocated;
    out[p.id] = closingBeforeIncome(p) + a - (p.election === 'cash' ? a : 0);
  }
  return out;
}

export function reducer(s: State, a: Action): State {
  if (s.periodClosed && !['setUser', 'reset', 'dismissToast', 'log'].includes(a.type))
    return refuse(s, a.type, 'Period is closed. Reset the demo to run it again.');
  switch (a.type) {
    case 'setUser':
      return { ...s, user: a.user, audit: audit(s, 'Signed in', `Acting as ${userName(a.user)} (${userRole(a.user)})`, 'info', 'System') };
    case 'setProfile':
      if (s.ledger.docs.length) return refuse(s, 'Change ERP', 'Journals already posted to this ERP. Reset to switch the target ledger.');
      return { ...s, profile: a.profile, audit: audit(s, 'Adapter profile changed', PROFILES[a.profile].label) };
    case 'setScenario':
      if (s.bankImported) return refuse(s, 'Change scenario', 'Bank statement already imported. Reset to change the scenario.');
      return { ...s, scenario: a.scenario };
    case 'prepare':
      if (s.user !== 'preparer') return refuse(s, 'Prepare run', 'Only the Preparer role can prepare an allocation run.');
      if (s.run.status !== 'draft') return s;
      return {
        ...s,
        run: { status: 'prepared', preparedBy: userName(s.user), inputHash: a.inputHash, outputHash: a.outputHash },
        audit: audit(s, 'Allocation prepared', `${RUN_ID}: inputs ${a.inputHash.slice(0, 12)}…, outputs ${a.outputHash.slice(0, 12)}…`, 'ok'),
        toast: { kind: 'ok', text: 'Run prepared and fingerprinted.' },
      };
    case 'submit':
      if (s.user !== 'preparer') return refuse(s, 'Submit run', 'Only the Preparer can submit a run for approval.');
      if (s.run.status !== 'prepared') return s;
      return {
        ...s,
        run: { ...s.run, status: 'submitted' },
        audit: audit(s, 'Submitted for approval', `${RUN_ID} frozen. Any change now needs a new run.`, 'ok'),
        toast: { kind: 'ok', text: 'Submitted. Switch to the Approver to approve.' },
      };
    case 'approve':
      if (s.run.status !== 'submitted') return s;
      if (userName(s.user) === s.run.preparedBy)
        return refuse(s, 'Approve run', 'Segregation of duties: the person who prepared a run cannot approve it.');
      if (s.user !== 'approver') return refuse(s, 'Approve run', `${userRole(s.user)} role has no approval authority.`);
      return {
        ...s,
        run: { ...s.run, status: 'approved', approvedBy: userName(s.user) },
        audit: audit(s, 'Run approved', `${RUN_ID} approved. Output hash ${s.run.outputHash?.slice(0, 12)}… locked.`, 'ok'),
        toast: { kind: 'ok', text: 'Approved. The journal can now go to the ERP.' },
      };
    case 'post': {
      if (s.run.status !== 'approved') return refuse(s, 'Post journal', 'Only an approved run can be posted.');
      if (a.kind === 'distribution' && !s.allocationAck?.docNo)
        return refuse(s, 'Post distribution', 'Post the allocation journal first.');
      const profile = PROFILES[s.profile];
      const events = a.kind === 'allocation' ? allocationEvents(ALLOC) : distributionEvents(ALLOC, PARTICIPANTS);
      const journal = buildJournal(events, profile, PARTICIPANTS, RUN_ID, a.kind);
      const liab = s.profile === 'sap' ? ['2150000'] : ['21500'];
      const pay = s.profile === 'sap' ? ['2160000'] : ['21600'];
      const { ledger, ack } = postJournal(s.ledger, journal, `${RUN_ID}/${a.kind}`, a.kind, profile.erp, liab, pay);
      return {
        ...s,
        ledger,
        allocationAck: a.kind === 'allocation' && ack.status === 'posted' ? ack : s.allocationAck,
        distributionAck: a.kind === 'distribution' && ack.status === 'posted' ? ack : s.distributionAck,
        audit: audit(
          s,
          ack.status === 'posted' ? `C7 ${a.kind} journal posted` : ack.status === 'duplicate' ? 'Duplicate send blocked' : 'Journal rejected',
          `${profile.erp}: ${ack.message}`,
          ack.status === 'posted' ? 'ok' : 'warn',
        ),
        toast: { kind: ack.status === 'posted' ? 'ok' : 'warn', text: ack.message },
      };
    }
    case 'releasePayments':
      if (!s.distributionAck) return refuse(s, 'Release payments', 'Post the distribution journal first.');
      return {
        ...s,
        paymentsReleased: true,
        audit: audit(s, 'C8 payment instructions sent', `${paymentInstructions().length} instructions handed to the ERP payment run. NVEST holds no bank details.`, 'ok'),
        toast: { kind: 'ok', text: 'Payment run executed in the ERP.' },
      };
    case 'importBank':
      if (!s.paymentsReleased) return refuse(s, 'Import bank statement', 'No payments released yet.');
      return {
        ...s,
        bankImported: true,
        audit: audit(s, 'C10 bank statement imported', 'camt.053 cleared items loaded for reconciliation.', 'info'),
        toast: { kind: 'info', text: 'Bank statement imported. Check reconciliation.' },
      };
    case 'signoff':
      if (s.user !== 'reconciler') return refuse(s, 'Sign off exception', 'Only the Reconciler can sign off exceptions.');
      return {
        ...s,
        signoffs: { ...s.signoffs, [a.id]: { by: userName(s.user), reason: a.reason, at: new Date().toISOString() } },
        audit: audit(s, `Exception ${a.id} signed off`, a.reason, 'ok'),
      };
    case 'closePeriod':
      if (s.user !== 'reconciler') return refuse(s, 'Close period', 'Only the Reconciler can close the period.');
      return { ...s, periodClosed: true, audit: audit(s, 'Period closed', 'October 2026 closed in NVEST. Statements released.', 'ok'), toast: { kind: 'ok', text: 'Period closed.' } };
    case 'log':
      return { ...s, audit: [...s.audit, { ...a.entry, at: new Date().toISOString() }] };
    case 'dismissToast':
      return { ...s, toast: undefined };
    case 'reset':
      return initial();
  }
}

const KEY = 'nvest-demo-v1';

function load(): State {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...initial(), ...(JSON.parse(raw) as State), toast: undefined };
  } catch {
    /* storage unavailable: start fresh */
  }
  return initial();
}

const Ctx = createContext<{ s: State; dispatch: (a: Action) => void } | null>(null);

export function StateProvider({ children }: { children: ReactNode }) {
  const [s, dispatch] = useReducer(reducer, undefined, load);
  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(s));
    } catch {
      /* ignore */
    }
  }, [s]);
  return <Ctx.Provider value={{ s, dispatch }}>{children}</Ctx.Provider>;
}

export function useApp() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useApp outside provider');
  return c;
}
