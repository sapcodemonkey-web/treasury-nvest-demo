// All money is held as integer cents. Formatting only at the edge.

export type Cents = number;

const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const usdCompact = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  notation: 'compact',
  maximumFractionDigits: 2,
});

export const fmt = (c: Cents): string => usd.format(c / 100);
export const fmtCompact = (c: Cents): string => usdCompact.format(c / 100);
export const fmtPct = (x: number, digits = 4): string => `${(x * 100).toFixed(digits)}%`;

export const dollars = (d: number): Cents => Math.round(d * 100);

export const sum = (xs: Cents[]): Cents => xs.reduce((a, b) => a + b, 0);
