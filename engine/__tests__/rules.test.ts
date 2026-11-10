import { describe, expect, it } from "vitest";
import { areaCoverage, fixed, linearCoverage, markupFromMargin, perCount, perSpacing, priceFromMargin, roundUp } from "..";

// Every expected value below was worked out by hand, not by running the code.
describe("rule types", () => {
  it("area coverage: 2,318 sq ft, 10% waste, 33.3 sq ft per bundle = 77 bundles", () => {
    // 2318 × 1.1 = 2549.8; ÷ 33.3 = 76.57; round up = 77
    expect(areaCoverage(2318, 0.1, 33.3).quantity).toBe(77);
  });

  it("linear coverage: 287 ft of eaves and rakes ÷ 10 ft = 29 pieces", () => {
    // 287 ÷ 10 = 28.7; round up = 29
    expect(linearCoverage(287, 0, 10).quantity).toBe(29);
  });

  it("per spacing: 176 ft 8 in of gutter, a hanger every 2 ft = 89 hangers", () => {
    // 176.667 ÷ 2 = 88.33; round up = 89
    expect(perSpacing(176 + 8 / 12, 2).quantity).toBe(89);
  });

  it("per count: 34 windows × 1 kit = 34", () => {
    expect(perCount(34, 1).quantity).toBe(34);
  });

  it("fixed: one dumpster per job", () => {
    expect(fixed(1).quantity).toBe(1);
  });

  it("never orders an extra unit because of floating point", () => {
    // 30 × 1.1 = 33.000000000000004 in floating point; ÷ 33 must still be 1
    expect(areaCoverage(30, 0.1, 33).quantity).toBe(1);
    expect(roundUp(3.0000000000001)).toBe(3);
    expect(roundUp(3.01)).toBe(4);
  });

  it("an exact fit needs no extra unit", () => {
    expect(areaCoverage(100, 0, 25).quantity).toBe(4);
  });

  it("refuses zero coverage, zero spacing and waste of 100% or more", () => {
    expect(() => areaCoverage(100, 0.1, 0)).toThrow();
    expect(() => perSpacing(100, 0)).toThrow();
    expect(() => linearCoverage(100, 1, 10)).toThrow();
    expect(() => linearCoverage(100, -0.1, 10)).toThrow();
  });
});

describe("pricing", () => {
  it("price = cost ÷ (1 − margin): $100.00 at 35% margin = $153.85", () => {
    // 10000 ÷ 0.65 = 15384.6 cents → 15385
    expect(priceFromMargin(10000, 0.35)).toBe(15385);
  });

  it("shows the markup equivalent: 35% margin = 53.8% markup", () => {
    expect(markupFromMargin(0.35)).toBeCloseTo(0.5385, 4);
  });

  it("refuses a margin of 100% or more, and below zero", () => {
    expect(() => priceFromMargin(10000, 1)).toThrow();
    expect(() => priceFromMargin(10000, 1.2)).toThrow();
    expect(() => priceFromMargin(10000, -0.1)).toThrow();
  });

  it("zero margin sells at cost", () => {
    expect(priceFromMargin(12345, 0)).toBe(12345);
  });
});
