import { describe, expect, it } from 'vitest';
import { PARTICIPANTS, PORTFOLIO, dailyBalances } from './data';
import { allocate } from './allocation';
import { PROFILES, allocationEvents, buildJournal, distributionEvents } from './posting';
import { bankStatement, emptyLedger, ledgerIncome, ledgerLiability, postJournal } from './ledger';
import { reconcile } from './recon';
import { sha256 } from './hash';
import { paymentInstructions, subledgerClosing } from '../state';
import { sum } from './money';

const alloc = allocate(PARTICIPANTS, PORTFOLIO);

describe('synthetic pool', () => {
  it('never has a negative daily balance', () => {
    for (const p of PARTICIPANTS) expect(Math.min(...dailyBalances(p))).toBeGreaterThanOrEqual(0);
  });
  it('includes a mid-month joiner and a full exit', () => {
    expect(PARTICIPANTS.some((p) => p.opening === 0)).toBe(true);
    expect(PARTICIPANTS.some((p) => dailyBalances(p).at(-1) === 0 && p.opening > 0)).toBe(true);
  });
});

describe('allocation', () => {
  it('allocates net income exactly to the cent', () => {
    expect(sum(alloc.lines.map((l) => l.allocated))).toBe(alloc.income.net);
  });
  it('shares sum to 1', () => {
    expect(sum(alloc.lines.map((l) => l.share))).toBeCloseTo(1, 12);
  });
  it('is deterministic (replay gives the same hash)', async () => {
    const again = allocate(PARTICIPANTS, PORTFOLIO);
    expect(await sha256(again)).toBe(await sha256(alloc));
  });
  it('produces a plausible net yield', () => {
    expect(alloc.income.netYieldAnnual).toBeGreaterThan(0.035);
    expect(alloc.income.netYieldAnnual).toBeLessThan(0.05);
  });
});

describe('posting rules', () => {
  for (const id of ['sap', 'oracle'] as const) {
    it(`${id} allocation and distribution journals balance`, () => {
      const j1 = buildJournal(allocationEvents(alloc), PROFILES[id], PARTICIPANTS, 'R1', 'allocation');
      const j2 = buildJournal(distributionEvents(alloc, PARTICIPANTS), PROFILES[id], PARTICIPANTS, 'R1', 'distribution');
      expect(j1.balanced).toBe(true);
      expect(j1.totalDebit).toBe(alloc.income.gross);
      expect(j2.balanced).toBe(true);
    });
  }
});

describe('ledger and reconciliation', () => {
  const profile = PROFILES.sap;
  const j1 = buildJournal(allocationEvents(alloc), profile, PARTICIPANTS, 'R1', 'allocation');
  const j2 = buildJournal(distributionEvents(alloc, PARTICIPANTS), profile, PARTICIPANTS, 'R1', 'distribution');
  const r1 = postJournal(emptyLedger(), j1, 'R1/allocation', 'allocation', 'SAP', ['2150000'], ['2160000']);
  const r2 = postJournal(r1.ledger, j2, 'R1/distribution', 'distribution', 'SAP', ['2150000'], ['2160000']);

  it('blocks a duplicate send', () => {
    const again = postJournal(r2.ledger, j1, 'R1/allocation', 'allocation', 'SAP', ['2150000'], ['2160000']);
    expect(again.ack.status).toBe('duplicate');
    expect(again.ledger.docs.length).toBe(2);
  });

  it('all four ties pass with no injected break', () => {
    const payments = paymentInstructions();
    const { ties, exceptions } = reconcile({
      alloc,
      ledgerIncome: ledgerIncome(alloc.income, false),
      subledgerClosing: subledgerClosing(),
      ledgerLiability: ledgerLiability(r2.ledger, PARTICIPANTS),
      distributionPosted: true,
      payments,
      bank: bankStatement(payments, false),
    });
    expect(ties.map((t) => t.status)).toEqual(['pass', 'pass', 'pass', 'pass']);
    expect(exceptions).toHaveLength(0);
  });

  it('cash break surfaces exceptions on tie 4', () => {
    const payments = paymentInstructions();
    const { ties, exceptions } = reconcile({
      alloc,
      ledgerIncome: ledgerIncome(alloc.income, false),
      subledgerClosing: subledgerClosing(),
      ledgerLiability: ledgerLiability(r2.ledger, PARTICIPANTS),
      distributionPosted: true,
      payments,
      bank: bankStatement(payments, true),
    });
    expect(ties[3].status).toBe('fail');
    expect(exceptions.length).toBe(2);
  });
});
