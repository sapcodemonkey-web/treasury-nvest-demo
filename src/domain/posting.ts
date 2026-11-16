// Posting-rules engine: accounting-neutral economic events -> journal lines in a target ERP's
// chart of accounts. The allocation engine never sees an account number.

import { Cents, sum } from './money';
import { AllocationResult } from './allocation';
import { PERIOD, Participant } from './data';

export type EventType =
  | 'IncomeReleased' // income recognized in the ledger is released for allocation
  | 'FeeCharged'
  | 'IncomeAllocated'
  | 'DistributionDeclared';

export interface EconomicEvent {
  type: EventType;
  qualifier: string; // income type, or participant id
  amount: Cents;
  participantId?: string;
}

export interface JournalLine {
  lineNo: number;
  segments: Record<string, string>;
  debit: Cents;
  credit: Cents;
  text: string;
  participantId?: string;
}

export interface Journal {
  header: Record<string, string>;
  lines: JournalLine[];
  totalDebit: Cents;
  totalCredit: Cents;
  balanced: boolean;
}

export type ProfileId = 'sap' | 'oracle';

interface Target {
  segments: Record<string, string>;
  side: 'debit' | 'credit';
}

export interface PostingProfile {
  id: ProfileId;
  label: string;
  erp: string;
  segmentNames: string[];
  header: (runId: string, kind: 'allocation' | 'distribution') => Record<string, string>;
  rule: (e: EconomicEvent, p?: Participant) => Target[];
}

const sap: PostingProfile = {
  id: 'sap',
  label: 'SAP S/4HANA (Public Sector)',
  erp: 'SAP',
  segmentNames: ['Company Code', 'G/L Account', 'Business Area', 'Fund', 'Fund Center', 'Assignment'],
  header: (runId, kind) => ({
    'Document Type': kind === 'allocation' ? 'ZN' : 'ZD',
    'Posting Date': '2026-10-31',
    'Fiscal Year / Period': `${PERIOD.fiscalYear.replace('FY', '')} / ${String(PERIOD.fiscalPeriod).padStart(3, '0')}`,
    Reference: runId,
    'Header Text': kind === 'allocation' ? 'NVEST income allocation' : 'NVEST cash distribution',
    Interface: 'Journal Entry API (released) / BAPI_ACC_DOCUMENT_POST',
  }),
  rule: (e, p) => {
    const base = { 'Company Code': '1000', 'Business Area': 'TR01', Fund: '6100', 'Fund Center': 'TRS-POOL' };
    const acct = (gl: string, assignment = '') => ({ ...base, 'G/L Account': gl, Assignment: assignment });
    switch (e.type) {
      case 'IncomeReleased': {
        const gl = { interest: '7100100', accretion: '7100200', realizedGL: '7100300' }[e.qualifier] ?? '7100900';
        return [{ segments: acct(gl, e.qualifier.toUpperCase()), side: e.amount >= 0 ? 'debit' : 'credit' }];
      }
      case 'FeeCharged':
        return [{ segments: acct('4400100', 'ADMIN-FEE'), side: 'credit' }];
      case 'IncomeAllocated':
        return [{ segments: acct('2150000', p?.externalKey ?? ''), side: 'credit' }];
      case 'DistributionDeclared':
        return [
          { segments: acct('2150000', p?.externalKey ?? ''), side: 'debit' },
          { segments: acct('2160000', p?.externalKey ?? ''), side: 'credit' },
        ];
    }
  },
};

const oracle: PostingProfile = {
  id: 'oracle',
  label: 'Oracle Fusion Cloud ERP',
  erp: 'Oracle',
  segmentNames: ['Company', 'Fund', 'Account', 'Cost Center', 'Program', 'Reference'],
  header: (runId, kind) => ({
    'Journal Source': 'NVEST',
    'Journal Category': kind === 'allocation' ? 'Pool Allocation' : 'Pool Distribution',
    'Accounting Period': 'OCT-26',
    'Accounting Date': '2026-10-31',
    'Batch Name': `NVEST-${runId}`,
    Interface: 'FBDI journal import via ERP Integration REST',
  }),
  rule: (e, p) => {
    const acct = (account: string, ref = '') => ({
      Company: '01',
      Fund: '610',
      Account: account,
      'Cost Center': '4300',
      Program: '000',
      Reference: ref,
    });
    switch (e.type) {
      case 'IncomeReleased': {
        const a = { interest: '46100', accretion: '46150', realizedGL: '46200' }[e.qualifier] ?? '46900';
        return [{ segments: acct(a, e.qualifier), side: e.amount >= 0 ? 'debit' : 'credit' }];
      }
      case 'FeeCharged':
        return [{ segments: acct('44100', 'admin fee'), side: 'credit' }];
      case 'IncomeAllocated':
        return [{ segments: acct('21500', p?.externalKey ?? ''), side: 'credit' }];
      case 'DistributionDeclared':
        return [
          { segments: acct('21500', p?.externalKey ?? ''), side: 'debit' },
          { segments: acct('21600', p?.externalKey ?? ''), side: 'credit' },
        ];
    }
  },
};

export const PROFILES: Record<ProfileId, PostingProfile> = { sap, oracle };

export function allocationEvents(alloc: AllocationResult): EconomicEvent[] {
  const { income } = alloc;
  const events: EconomicEvent[] = [
    { type: 'IncomeReleased', qualifier: 'interest', amount: income.interest },
    { type: 'IncomeReleased', qualifier: 'accretion', amount: income.accretion },
    { type: 'IncomeReleased', qualifier: 'realizedGL', amount: income.realizedGL },
    { type: 'FeeCharged', qualifier: 'admin', amount: income.fee },
  ];
  for (const l of alloc.lines) {
    if (l.allocated !== 0)
      events.push({ type: 'IncomeAllocated', qualifier: l.participantId, amount: l.allocated, participantId: l.participantId });
  }
  return events;
}

export function distributionEvents(alloc: AllocationResult, participants: Participant[]): EconomicEvent[] {
  return alloc.lines
    .filter((l) => participants.find((p) => p.id === l.participantId)?.election === 'cash' && l.allocated > 0)
    .map((l) => ({ type: 'DistributionDeclared', qualifier: l.participantId, amount: l.allocated, participantId: l.participantId }));
}

export function buildJournal(
  events: EconomicEvent[],
  profile: PostingProfile,
  participants: Participant[],
  runId: string,
  kind: 'allocation' | 'distribution',
): Journal {
  const lines: JournalLine[] = [];
  for (const e of events) {
    const p = e.participantId ? participants.find((x) => x.id === e.participantId) : undefined;
    for (const t of profile.rule(e, p)) {
      const amt = Math.abs(e.amount);
      if (amt === 0) continue;
      lines.push({
        lineNo: lines.length + 1,
        segments: t.segments,
        debit: t.side === 'debit' ? amt : 0,
        credit: t.side === 'credit' ? amt : 0,
        text: p ? `${e.type} · ${p.name}` : `${e.type} · ${e.qualifier}`,
        participantId: p?.id,
      });
    }
  }
  const totalDebit = sum(lines.map((l) => l.debit));
  const totalCredit = sum(lines.map((l) => l.credit));
  return { header: profile.header(runId, kind), lines, totalDebit, totalCredit, balanced: totalDebit === totalCredit };
}
