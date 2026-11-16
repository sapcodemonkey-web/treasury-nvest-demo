// Income summary (C5) and average-daily-balance allocation.

import { Cents, sum } from './money';
import { PERIOD, POOL, Participant, Security, dailyBalances } from './data';

export interface IncomeSummary {
  interest: Cents;
  accretion: Cents;
  realizedGL: Cents;
  gross: Cents;
  fee: Cents;
  net: Cents;
  totalBalanceDays: number; // sum of daily balances in cents·days
  totalAdb: Cents;
  netYieldAnnual: number;
}

export interface AllocationLine {
  participantId: string;
  adb: Cents;
  balanceDays: number;
  share: number;
  raw: number; // unrounded cents
  allocated: Cents;
  roundingCent: boolean; // received a residual cent from largest-remainder
}

export interface AllocationResult {
  income: IncomeSummary;
  lines: AllocationLine[];
  residualCents: number; // cents distributed by largest remainder
}

export function incomeSummary(participants: Participant[], portfolio: Security[]): IncomeSummary {
  const interest = sum(portfolio.map((s) => s.interest));
  const accretion = sum(portfolio.map((s) => s.accretion));
  const realizedGL = sum(portfolio.map((s) => s.realizedGL));
  const gross = interest + accretion + realizedGL;
  const totalBalanceDays = sum(participants.map((p) => sum(dailyBalances(p))));
  const totalAdb = Math.round(totalBalanceDays / PERIOD.days);
  const fee = Math.round((totalAdb * (POOL.feeBpsAnnual / 10_000) * PERIOD.days) / 365);
  const net = gross - fee;
  const netYieldAnnual = (net / totalAdb) * (365 / PERIOD.days);
  return { interest, accretion, realizedGL, gross, fee, net, totalBalanceDays, totalAdb, netYieldAnnual };
}

/**
 * Allocate net income by share of balance-days. Rounds each share down to the cent,
 * then hands remaining cents to the largest fractional remainders (ties by participant id)
 * so the allocations always sum exactly to net income.
 */
export function allocate(participants: Participant[], portfolio: Security[]): AllocationResult {
  const income = incomeSummary(participants, portfolio);
  const lines: AllocationLine[] = participants.map((p) => {
    const balanceDays = sum(dailyBalances(p));
    const share = balanceDays / income.totalBalanceDays;
    const raw = income.net * share;
    return {
      participantId: p.id,
      adb: Math.round(balanceDays / PERIOD.days),
      balanceDays,
      share,
      raw,
      allocated: Math.floor(raw),
      roundingCent: false,
    };
  });
  let residual = income.net - sum(lines.map((l) => l.allocated));
  const residualCents = residual;
  const order = [...lines].sort(
    (a, b) => b.raw - Math.floor(b.raw) - (a.raw - Math.floor(a.raw)) || a.participantId.localeCompare(b.participantId),
  );
  for (const l of order) {
    if (residual <= 0) break;
    if (l.balanceDays === 0) continue;
    l.allocated += 1;
    l.roundingCent = true;
    residual -= 1;
  }
  return { income, lines, residualCents };
}
