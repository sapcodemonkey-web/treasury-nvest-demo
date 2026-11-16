// Synthetic pool: a fictional local-government investment pool for one month.
// Everything here is generated deterministically from a seed. No real entities.

import { Cents, dollars, sum } from './money';
import { mulberry32, randInt } from './rng';

export const PERIOD = {
  id: '2026-10',
  label: 'October 2026',
  start: '2026-10-01',
  days: 31,
  fiscalYear: 'FY2027',
  fiscalPeriod: 4,
};

export const POOL = {
  id: 'NVEST-LGIP-01',
  name: 'Carolina Local Government Investment Pool (fictional)',
  feeBpsAnnual: 5, // administration fee, basis points on average daily balance
};

export type ParticipantType =
  | 'State Agency'
  | 'County'
  | 'Municipality'
  | 'School District'
  | 'Utility'
  | 'Higher Education';

export type Election = 'cash' | 'reinvest';

export interface Flow {
  day: number; // 1-based day of month, effective start of day
  amount: Cents; // + deposit, - withdrawal
}

export interface Participant {
  id: string;
  name: string;
  type: ParticipantType;
  election: Election;
  externalKey: string; // party key in the customer's ERP
  opening: Cents;
  flows: Flow[];
}

export type SecurityType = 'T-Bill' | 'T-Note' | 'Agency' | 'Commercial Paper' | 'Repo';

export interface Security {
  id: string;
  description: string;
  type: SecurityType;
  par: Cents;
  yieldPct: number; // annual
  interest: Cents; // coupon/discount interest earned in period
  accretion: Cents; // discount accretion net of premium amortization
  realizedGL: Cents;
}

const NAMES: Array<[string, ParticipantType]> = [
  ['Department of Transportation', 'State Agency'],
  ['Department of Health Services', 'State Agency'],
  ['State Ports Authority', 'State Agency'],
  ['Office of Higher Education Grants', 'State Agency'],
  ['Riverbend County', 'County'],
  ['Pine Hollow County', 'County'],
  ['Saltmarsh County', 'County'],
  ['Granite Ridge County', 'County'],
  ['Blue Heron County', 'County'],
  ['City of Cedar Falls', 'Municipality'],
  ['Town of Maple Crossing', 'Municipality'],
  ['City of Harbor View', 'Municipality'],
  ['Town of Oak Bluff', 'Municipality'],
  ['City of Laurel Springs', 'Municipality'],
  ['Riverbend County Schools', 'School District'],
  ['Lakeside School District', 'School District'],
  ['Pine Hollow Unified Schools', 'School District'],
  ['Coastal Plains School District', 'School District'],
  ['Upstate Water Authority', 'Utility'],
  ['Midlands Electric Cooperative', 'Utility'],
  ['Harbor View Public Utilities', 'Utility'],
  ['Piedmont Technical College', 'Higher Education'],
  ['Lowcountry State University', 'Higher Education'],
  ['Foothills Community College', 'Higher Education'],
];

function buildParticipants(): Participant[] {
  const rng = mulberry32(20261031);
  return NAMES.map(([name, type], i) => {
    const id = `P${String(i + 1).padStart(3, '0')}`;
    const scale =
      type === 'State Agency' ? 250 : type === 'County' ? 120 : type === 'Utility' ? 90 : type === 'Higher Education' ? 70 : 45;
    const opening = dollars(randInt(rng, Math.round(scale * 0.25), scale) * 1_000_000 + randInt(rng, 0, 999_999));
    const flows: Flow[] = [];
    const nFlows = randInt(rng, 0, 3);
    for (let f = 0; f < nFlows; f++) {
      const day = randInt(rng, 2, PERIOD.days);
      const mag = dollars(randInt(rng, 1, Math.round(scale / 8)) * 1_000_000 + randInt(rng, 0, 99_999));
      flows.push({ day, amount: rng() < 0.55 ? mag : -mag });
    }
    return {
      id,
      name,
      type,
      election: rng() < 0.35 ? 'cash' : 'reinvest',
      externalKey: `BP${String(4100000 + i * 37)}`,
      opening,
      flows,
    };
  });
}

/** Scripted edge cases so the demo has something to explain. */
function withScenarios(ps: Participant[]): Participant[] {
  const out = ps.map((p) => ({ ...p, flows: [...p.flows] }));
  // Joins mid-month: no opening balance, deposit on the 12th.
  const joiner = out[12];
  joiner.opening = 0;
  joiner.flows = [{ day: 12, amount: dollars(18_500_000) }];
  joiner.election = 'reinvest';
  // Exits on the 20th: withdraws its whole balance, still earns for days held.
  const leaver = out[7];
  leaver.flows = [];
  leaver.flows.push({ day: 20, amount: -leaver.opening });
  leaver.election = 'cash';
  // Clamp flows so no balance ever goes negative.
  for (const p of out) {
    let bal = p.opening;
    const sorted = [...p.flows].sort((a, b) => a.day - b.day);
    for (const f of sorted) {
      if (bal + f.amount < 0) f.amount = -bal;
      bal += f.amount;
    }
    p.flows = sorted.filter((f) => f.amount !== 0);
  }
  return out;
}

export const PARTICIPANTS: Participant[] = withScenarios(buildParticipants());

/** Daily closing balances, index 0 = day 1. */
export function dailyBalances(p: Participant): Cents[] {
  const out: Cents[] = [];
  let bal = p.opening;
  for (let d = 1; d <= PERIOD.days; d++) {
    for (const f of p.flows) if (f.day === d) bal += f.amount;
    out.push(bal);
  }
  return out;
}

export function closingBeforeIncome(p: Participant): Cents {
  return p.opening + sum(p.flows.map((f) => f.amount));
}

function buildPortfolio(): Security[] {
  const totalAdb =
    sum(PARTICIPANTS.map((p) => sum(dailyBalances(p)))) / PERIOD.days;
  const mix: Array<[SecurityType, string, number, number]> = [
    // type, description, weight, yield %
    ['T-Bill', 'US Treasury Bill 12/04/2026', 0.12, 4.18],
    ['T-Bill', 'US Treasury Bill 01/15/2027', 0.1, 4.12],
    ['T-Note', 'US Treasury Note 4.25% 06/30/2027', 0.09, 4.05],
    ['T-Note', 'US Treasury Note 3.875% 11/30/2027', 0.07, 3.98],
    ['Agency', 'FHLB Discount Note 02/10/2027', 0.1, 4.15],
    ['Agency', 'FFCB 4.10% 09/15/2027', 0.08, 4.1],
    ['Agency', 'FNMA 4.00% 03/12/2027', 0.06, 4.02],
    ['Commercial Paper', 'Northgate Capital CP A1/P1 11/20/2026', 0.07, 4.32],
    ['Commercial Paper', 'Seaboard Funding CP A1/P1 12/18/2026', 0.06, 4.29],
    ['Commercial Paper', 'Palmetto Receivables CP A1/P1 01/08/2027', 0.05, 4.27],
    ['Repo', 'Tri-party Repo (UST collateral) O/N', 0.2, 4.08],
  ];
  return mix.map(([type, description, w, y], i) => {
    const par = Math.round((totalAdb * w) / 1_000_000) * 1_000_000; // round to $10k
    const periodIncome = Math.round((par * (y / 100) * PERIOD.days) / 365);
    const discount = type === 'T-Bill' || type === 'Commercial Paper' || description.includes('Discount');
    const accretion = discount ? Math.round(periodIncome * 0.92) : type === 'T-Note' ? -Math.round(periodIncome * 0.04) : 0;
    const interest = discount ? periodIncome - accretion : periodIncome;
    return {
      id: `SEC${String(i + 1).padStart(3, '0')}`,
      description,
      type,
      par,
      yieldPct: y,
      interest,
      accretion,
      realizedGL: i === 3 ? dollars(-41_870.55) : i === 5 ? dollars(63_212.4) : 0,
    };
  });
}

export const PORTFOLIO: Security[] = buildPortfolio();

export const USERS = [
  { id: 'preparer', name: 'Pat Reyes', role: 'Preparer' },
  { id: 'approver', name: 'Jordan Lee', role: 'Approver' },
  { id: 'reconciler', name: 'Sam Ortiz', role: 'Reconciler' },
] as const;

export type UserId = (typeof USERS)[number]['id'];
