import { describe, expect, it } from "vitest";
import {
  allocateProportionally,
  formatMoney,
  formatQty,
  invoiceTotals,
  lineAmountMinor,
  roundHalfUp,
} from "./money";

describe("roundHalfUp", () => {
  it("rounds .5 up", () => {
    expect(roundHalfUp(127.5)).toBe(128);
    expect(roundHalfUp(0.5)).toBe(1);
  });
  it("keeps integers exact", () => {
    expect(roundHalfUp(100)).toBe(100);
  });
});

describe("lineAmountMinor", () => {
  it("7.5 hr at $75.00 = $562.50", () => {
    expect(lineAmountMinor(7500, 7500)).toBe(56250);
  });
  it("rounds odd qty×rate half-up", () => {
    // 17 milli-hr × 7500 = 127.5 minor
    expect(lineAmountMinor(17, 7500)).toBe(128);
  });
  it("zero qty is zero", () => {
    expect(lineAmountMinor(0, 7500)).toBe(0);
  });
});

describe("allocateProportionally", () => {
  it("parts sum exactly to the total", () => {
    const parts = allocateProportionally(500, [3333, 3333, 3334]);
    // exact shares: [166.5, 166.5, 166.7] -> floors 166×3, 2 leftover units
    // go to largest fractions (index 2, then index 0)
    expect(parts.reduce((a, b) => a + b, 0)).toBe(500);
    expect(parts).toEqual([167, 166, 167]);
  });
  it("handles zero weights", () => {
    expect(allocateProportionally(500, [0, 0])).toEqual([0, 0]);
  });
  it("zero total yields all zeros", () => {
    expect(allocateProportionally(0, [10, 20])).toEqual([0, 0]);
  });
  it("single line takes the whole total", () => {
    expect(allocateProportionally(123, [42])).toEqual([123]);
  });
});

describe("invoiceTotals", () => {
  const hr = (min: number, taxBps = 0) => ({
    qtyMilli: Math.round((min / 60) * 1000),
    rateMinor: 7500,
    taxBps,
  });

  it("seed invoice 2026-001: 7.5 hr total, 18% per-line tax", () => {
    // line amounts: 18750, 26250, 11250 -> subtotal 56250
    // per-line tax (18%): 3375 + 4725 + 2025 = 10125
    const totals = invoiceTotals([hr(150, 1800), hr(210, 1800), hr(90, 1800)], 0);
    expect(totals.subtotalMinor).toBe(56250);
    expect(totals.taxMinor).toBe(10125);
    expect(totals.totalMinor).toBe(66375);
  });

  it("tax applies to the line amount net of its discount share", () => {
    // one line: 100.00, 10% discount, 10% tax -> 90.00 taxable, 9.00 tax, 99.00 total
    const totals = invoiceTotals(
      [{ qtyMilli: 1000, rateMinor: 10000, taxBps: 1000 }],
      1000,
    );
    expect(totals.subtotalMinor).toBe(10000);
    expect(totals.discountMinor).toBe(1000);
    expect(totals.taxMinor).toBe(900);
    expect(totals.totalMinor).toBe(9900);
  });

  it("multi-line discount + tax reconcile exactly", () => {
    const lines = [
      { qtyMilli: 1000, rateMinor: 3333, taxBps: 700 },
      { qtyMilli: 1000, rateMinor: 3333, taxBps: 700 },
      { qtyMilli: 1000, rateMinor: 3334, taxBps: 0 },
    ];
    const totals = invoiceTotals(lines, 500);
    expect(totals.subtotalMinor).toBe(10000);
    expect(totals.discountMinor).toBe(500);
    // discount shares: [167, 166, 167]; taxable: [3166, 3167, 3167]
    // tax half-up: 3166*0.07=221.62 -> 222; 3167*0.07=221.69 -> 222; 0
    expect(totals.taxMinor).toBe(444);
    expect(totals.totalMinor).toBe(10000 - 500 + 444);
  });

  it("zero lines produce zeros", () => {
    const totals = invoiceTotals([], 500);
    expect(totals).toEqual({
      subtotalMinor: 0,
      discountMinor: 0,
      taxMinor: 0,
      totalMinor: 0,
    });
  });
});

describe("formatMoney", () => {
  it("formats minor units with the currency symbol", () => {
    expect(formatMoney(56250, "USD")).toBe("$562.50");
    expect(formatMoney(56250, "EUR")).toBe("€562.50");
  });
  it("handles zero-decimal currencies", () => {
    expect(formatMoney(1000, "JPY")).toBe("¥1,000");
  });
});

describe("formatQty", () => {
  it("drops trailing zeros", () => {
    expect(formatQty(7500)).toBe("7.5");
    expect(formatQty(1000)).toBe("1");
    expect(formatQty(1250)).toBe("1.25");
  });
});
