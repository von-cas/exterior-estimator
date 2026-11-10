import { describe, expect, it } from "vitest";
import { calculate, customerView, takeoff, withDerived, type EstimateInputs, type Trade } from "..";
import { LABOR, LABOR_RATES, MARGINS, PRODUCTS, TEMPLATE, demoMeasurements } from "../../supabase/seed/demo-data";

const inputs = (trades: Trade[], over: Partial<EstimateInputs> = {}): EstimateInputs => ({
  trades, measurements: withDerived(demoMeasurements()), template: TEMPLATE, labor: LABOR,
  products: PRODUCTS, laborRates: LABOR_RATES, margins: MARGINS, ...over,
});
const qty = (r: ReturnType<typeof calculate>, key: string) => r.materials.find((m) => m.key === key)?.quantity;

// Hand-worked against the sample report with the demo catalog (made-up prices).
describe("roofing", () => {
  const r = calculate(inputs(["roofing"]));
  it("calculates every line", () => {
    expect(r.issues).toEqual([]);
    expect(qty(r, "roof.shingles")).toBe(77); // 2318 × 1.1 ÷ 33.3 = 76.57
    expect(qty(r, "roof.underlayment")).toBe(3); // 2549.8 ÷ 1000 = 2.55
    expect(qty(r, "roof.ice_water")).toBe(3); // 176.67 × 1.05 ÷ 66.7 = 2.78
    expect(qty(r, "roof.starter")).toBe(3); // 287.08 × 1.05 ÷ 105 = 2.87
    expect(qty(r, "roof.ridge")).toBe(3); // 90.08 × 1.05 ÷ 33 = 2.87
    expect(qty(r, "roof.drip_edge")).toBe(29); // 287.08 ÷ 10 = 28.7
    expect(qty(r, "roof.step_flashing")).toBe(2); // 72.17 × 1.1 ÷ 58 = 1.37
    expect(qty(r, "roof.pipe_boots")).toBe(3);
    expect(qty(r, "roof.nails")).toBe(2); // 2549.8 ÷ 1800 = 1.42
    expect(qty(r, "roof.dumpster")).toBe(1);
  });
  it("prices the trade: cost $7,903.65, price $12,159.46 at 35% margin", () => {
    // materials 4,890.25 + labor 23.18 sq × (85 + 45) = 3,013.40 → 7,903.65; ÷ 0.65
    const t = r.trades[0];
    expect(t.materialCost).toBe(489025);
    expect(t.laborCost).toBe(301340);
    expect(t.cost).toBe(790365);
    expect(t.price).toBe(1215946);
  });
});

describe("siding", () => {
  const r = calculate(inputs(["siding"]));
  it("calculates every line", () => {
    expect(r.issues).toEqual([]);
    expect(qty(r, "siding.panels")).toBe(28); // 2513 × 1.1 ÷ 100 = 27.64
    expect(qty(r, "siding.wrap")).toBe(3); // 2764.3 ÷ 999 = 2.77
    expect(qty(r, "siding.starter")).toBe(17); // 193.92 × 1.05 ÷ 12 = 16.97
    expect(qty(r, "siding.outside_corners")).toBe(16); // 145.5 × 1.05 ÷ 10 = 15.28
    expect(qty(r, "siding.inside_corners")).toBe(9); // 76.92 × 1.05 ÷ 10 = 8.08
    expect(qty(r, "siding.j_channel")).toBe(27); // (88.25 + 64.5 + 149) × 1.1 ÷ 12.5 = 26.55
    expect(qty(r, "siding.soffit")).toBe(38); // (457 + 92) × 1.1 ÷ 16 = 37.74
    expect(qty(r, "siding.frieze")).toBe(18); // 187.17 × 1.1 ÷ 12 = 17.16
  });
});

describe("windows", () => {
  const r = calculate(inputs(["windows"]));
  it("prices each size by its united-inch band and locks them for purchase", () => {
    const units = r.materials.filter((m) => m.key.startsWith("windows.units"));
    expect(units).toHaveLength(9);
    const byRole = (sku: string) => units.filter((m) => m.sku === sku).reduce((s, m) => s + m.quantity, 0);
    expect(byRole("WN-DH-75")).toBe(18); // 9 + 4 + 4 + 1
    expect(byRole("WN-DH-90")).toBe(15); // 5 + 5 + 3 + 2 (47 × 43 = exactly 90)
    expect(byRole("WN-DH-101")).toBe(1); // 29 × 64 = 93
    expect(units.every((m) => m.lockedForPurchase)).toBe(true);
  });
  it("prices the trade: cost $17,323.00, price $24,747.14 at 30% margin", () => {
    // 18 × 285 + 15 × 340 + 1 × 395 + 34 × 22 = 11,373; + 34 × 175 = 17,323; ÷ 0.7
    expect(r.trades[0].cost).toBe(1732300);
    expect(r.trades[0].price).toBe(2474714);
  });
});

describe("gutters", () => {
  const r = calculate(inputs(["gutters"]));
  it("calculates every line", () => {
    expect(r.issues).toEqual([]);
    expect(qty(r, "gutters.gutter")).toBe(186); // 176.67 × 1.05 = 185.5
    expect(qty(r, "gutters.hangers")).toBe(89); // 176.67 ÷ 2 = 88.33
    expect(qty(r, "gutters.downspouts")).toBe(12); // 6 × 18 ft × 1.1 ÷ 10 = 11.88
    expect(qty(r, "gutters.outlets")).toBe(6);
    expect(qty(r, "gutters.corners")).toBe(6);
  });
});

describe("missing measurements", () => {
  it("never turns into zero: the line is left out and a blocking issue is raised", () => {
    const m = withDerived(demoMeasurements({}));
    const r = calculate(inputs(["gutters"], { measurements: m }));
    expect(qty(r, "gutters.downspouts")).toBeUndefined();
    expect(qty(r, "gutters.corners")).toBeUndefined();
    expect(qty(r, "gutters.gutter")).toBe(186);
    const codes = r.issues.map((i) => `${i.level}:${i.code}`);
    expect(codes).toContain("blocking:missing_measurement");
    expect(r.issues.some((i) => i.message.startsWith("downspout_length"))).toBe(true);
  });
});

describe("changing inputs", () => {
  it("a different product or waste recalculates the line", () => {
    const r = calculate(inputs(["roofing"], {
      selections: { shingle: PRODUCTS.find((p) => p.sku === "SH-DES-SLT")!.id },
      wasteOverrides: { "roof.shingles": 0.15 },
    }));
    // 2318 × 1.15 ÷ 25 = 106.6 → 107
    expect(qty(r, "roof.shingles")).toBe(107);
  });
});

describe("takeoff and customer view come from the same calculation", () => {
  const r = calculate(inputs(["roofing", "siding", "windows", "gutters"]));
  it("groups every material line by supplier with no line lost", () => {
    const groups = takeoff(r);
    expect(groups.flatMap((g) => g.lines)).toHaveLength(r.materials.length);
    expect(groups.reduce((s, g) => s + g.cost, 0)).toBe(r.materials.reduce((s, m) => s + m.cost, 0));
  });
  it("the customer view has prices but no cost, margin or production-only lines", () => {
    const view = JSON.stringify(customerView(r));
    expect(view).not.toMatch(/cost|margin/i);
    expect(view).not.toContain("Roofing nails");
    expect(customerView(r).total).toBe(r.totalPrice);
  });
});
