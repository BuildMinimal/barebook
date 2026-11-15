/*
 * Money math. All amounts are integer minor units; all arithmetic stays in
 * integers except one division per rounding step, rounded half-up.
 * Every rule here is covered by src/lib/money.test.ts — change both together.
 */

/** Round half-up for non-negative values (the only case money math produces). */
export function roundHalfUp(n: number): number {
  return Math.floor(n + 0.5);
}

/** Line amount: qty in thousandths × rate in minor units, rounded half-up. */
export function lineAmountMinor(qtyMilli: number, rateMinor: number): number {
  return roundHalfUp((qtyMilli * rateMinor) / 1000);
}

/**
 * Allocate a total across lines proportionally to weights (largest-remainder
 * method) so the parts sum to exactly `total` — no rounding residue.
 * `total` and all weights must be non-negative.
 */
export function allocateProportionally(
  total: number,
  weights: number[],
): number[] {
  const weightSum = weights.reduce((a, b) => a + b, 0);
  if (weightSum === 0 || total === 0) return weights.map(() => 0);

  const exact = weights.map((w) => (total * w) / weightSum);
  const parts = exact.map(Math.floor);
  let remainder = total - parts.reduce((a, b) => a + b, 0);

  // Hand out the leftover units to the lines with the largest fractional loss.
  const order = exact
    .map((value, i) => ({ i, frac: value - Math.floor(value) }))
    .sort((a, b) => b.frac - a.frac);

  for (const { i } of order) {
    if (remainder <= 0) break;
    parts[i] += 1;
    remainder -= 1;
  }
  return parts;
}

export interface InvoiceLineInput {
  qtyMilli: number;
  rateMinor: number;
  taxBps: number;
}

export interface InvoiceTotals {
  /** Sum of line amounts, before discount and tax. */
  subtotalMinor: number;
  /** Invoice-level discount, allocated across lines. */
  discountMinor: number;
  /** Per-line tax on the line amount minus its discount share. */
  taxMinor: number;
  /** subtotal − discount + tax. */
  totalMinor: number;
}

/**
 * Invoice totals with tax computed on what the client actually pays for each
 * line (line amount minus its share of the invoice-level discount). The
 * discount is allocated proportionally so per-line tax + discount reconcile
 * exactly to the invoice total.
 */
export function invoiceTotals(
  lines: InvoiceLineInput[],
  discountBps: number,
): InvoiceTotals {
  const lineAmounts = lines.map((l) => lineAmountMinor(l.qtyMilli, l.rateMinor));
  const subtotalMinor = lineAmounts.reduce((a, b) => a + b, 0);
  const discountMinor = roundHalfUp((subtotalMinor * discountBps) / 10000);
  const discountShares = allocateProportionally(discountMinor, lineAmounts);

  let taxMinor = 0;
  for (let i = 0; i < lines.length; i++) {
    const taxable = lineAmounts[i] - discountShares[i];
    taxMinor += roundHalfUp((taxable * lines[i].taxBps) / 10000);
  }

  return {
    subtotalMinor,
    discountMinor,
    taxMinor,
    totalMinor: subtotalMinor - discountMinor + taxMinor,
  };
}

/**
 * "562.50" style — Intl handles currency placement. Scales by the currency's
 * own fraction digits (2 for USD/EUR, 0 for JPY etc.), so "minor units" means
 * the smallest unit of that currency.
 */
export function formatMoney(minor: number, currency: string): string {
  const digits =
    new Intl.NumberFormat("en-US", { style: "currency", currency })
      .resolvedOptions().maximumFractionDigits ?? 2;
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(
    minor / 10 ** digits,
  );
}

/** Quantity in thousandths → "7.5"; trims trailing zeros (7.500 → "7.5"). */
export function formatQty(qtyMilli: number): string {
  const value = qtyMilli / 1000;
  return Number.isInteger(value) ? String(value) : value.toFixed(3).replace(/0+$/, "");
}
