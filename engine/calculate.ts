import { areaCoverage, fixed, linearCoverage, perCount, perSpacing, unitedInches, type RuleResult } from "./rules";
import { markupFromMargin, priceFromMargin } from "./pricing";
import type {
  EstimateInputs, EstimateResult, Issue, LaborItem, MaterialLine, Product, TemplateLine, Trade, TradeTotal,
} from "./types";

/**
 * The one calculation. The customer estimate and the production takeoff are
 * both views of this result, so they cannot disagree.
 * A missing measurement never becomes zero: the line is left out and a
 * blocking issue says why.
 */
export function calculate(inputs: EstimateInputs): EstimateResult {
  const issues: Issue[] = [];
  const materials: MaterialLine[] = [];
  const labor: LaborItem[] = [];
  const included = new Set(inputs.trades);

  for (const line of inputs.template) {
    if (!included.has(line.trade)) continue;
    try {
      materials.push(...materialLines(line, inputs, issues));
    } catch (e) {
      issues.push({ level: "blocking", code: "line_error", lineKey: line.key, message: `${line.label}: ${(e as Error).message}` });
    }
  }

  for (const l of inputs.labor) {
    if (!included.has(l.trade)) continue;
    const rate = inputs.laborRates.find((r) => r.trade === l.trade && r.task === l.task);
    if (!rate) {
      issues.push({ level: "blocking", code: "no_labor_rate", lineKey: l.key, message: `No labor rate for ${l.trade} / ${l.task}` });
      continue;
    }
    const base = l.measurement === "window_count"
      ? inputs.measurements.windows.reduce((s, w) => s + w.count, 0)
      : value(inputs, l.measurement, l.key, l.label, issues);
    if (base === null) continue;
    let qty = base / (l.per ?? 1);
    let workings = l.per ? `${fmt(base)} ÷ ${l.per} = ${fmt(qty)} ${rate.unit}` : `${fmt(qty)} ${rate.unit}`;
    if (l.times) {
      const t = value(inputs, l.times, l.key, l.label, issues);
      if (t === null) continue;
      qty *= t;
      workings += ` × ${fmt(t)} (${l.times.replace(/_/g, " ")})`;
    }
    qty = Math.round(qty * 100) / 100;
    labor.push({
      key: l.key, trade: l.trade, label: l.label, quantity: qty, unit: rate.unit, rate: rate.rate,
      cost: Math.round(qty * rate.rate), workings,
    });
  }

  const trades: TradeTotal[] = inputs.trades.map((trade) => {
    const materialCost = sum(materials.filter((m) => m.trade === trade).map((m) => m.cost));
    const laborCost = sum(labor.filter((l) => l.trade === trade).map((l) => l.cost));
    const cost = materialCost + laborCost;
    const margin = inputs.margins[trade];
    return { trade, materialCost, laborCost, cost, margin, markup: markupFromMargin(margin), price: priceFromMargin(cost, margin) };
  });

  return {
    materials, labor, trades, issues,
    totalCost: sum(trades.map((t) => t.cost)),
    totalPrice: sum(trades.map((t) => t.price)),
  };
}

function materialLines(line: TemplateLine, inputs: EstimateInputs, issues: Issue[]): MaterialLine[] {
  if (line.rule === "per_item") return windowLines(line, inputs, issues);

  const product = pickProduct(line.role, inputs);
  if (!product) {
    issues.push({ level: "blocking", code: "no_product", lineKey: line.key, message: `${line.label}: no product for role ${line.role}` });
    return [];
  }
  const waste = inputs.wasteOverrides?.[line.key] ?? line.waste ?? 0;
  let r: RuleResult;
  if (line.rule === "fixed") {
    r = fixed(line.quantity ?? 1);
  } else {
    const v = value(inputs, line.measurement!, line.key, line.label, issues);
    if (v === null) return [];
    switch (line.rule) {
      case "area": r = areaCoverage(v, waste, need(product.coverage, product)); break;
      case "linear": r = linearCoverage(v, waste, need(product.coverage, product)); break;
      case "per_spacing": r = perSpacing(v, line.spacing ?? 0); break;
      case "per_count": r = perCount(v, line.qtyEach ?? 1); break;
      default: throw new Error(`unknown rule ${line.rule satisfies never}`);
    }
  }
  if (r.quantity === 0) return [];
  return [toLine(line, product, r.quantity, r.workings, false)];
}

/** One line per window size, priced by its united-inch band. */
function windowLines(line: TemplateLine, inputs: EstimateInputs, issues: Issue[]): MaterialLine[] {
  const bands = [...(line.bands ?? [])].sort((a, b) => a.maxUnitedInches - b.maxUnitedInches);
  const out: MaterialLine[] = [];
  for (const w of inputs.measurements.windows) {
    const ui = unitedInches(w.width, w.height);
    const band = bands.find((b) => ui <= b.maxUnitedInches);
    if (!band) {
      issues.push({ level: "blocking", code: "window_too_large", lineKey: line.key, message: `${w.width} × ${w.height} in (${ui} UI) is larger than any priced window band` });
      continue;
    }
    const product = pickProduct(band.role, inputs);
    if (!product) {
      issues.push({ level: "blocking", code: "no_product", lineKey: line.key, message: `No product for role ${band.role}` });
      continue;
    }
    out.push({
      ...toLine(line, product, w.count, `${w.count} × ${w.width} × ${w.height} in (${ui} UI, band ≤ ${band.maxUnitedInches})`, true),
      key: `${line.key}:${w.width}x${w.height}`,
      label: `${line.label} ${w.width} × ${w.height}`,
    });
  }
  return out;
}

function toLine(line: TemplateLine, p: Product, quantity: number, workings: string, locked: boolean): MaterialLine {
  return {
    key: line.key, trade: line.trade, label: line.label, productId: p.id, sku: p.sku, productName: p.name,
    supplier: p.supplier, unit: p.unit, quantity, unitCost: p.unitCost, cost: quantity * p.unitCost,
    productionOnly: line.productionOnly ?? false, workings, lockedForPurchase: locked,
  };
}

function pickProduct(role: string, inputs: EstimateInputs): Product | undefined {
  const chosen = inputs.selections?.[role];
  if (chosen) {
    const p = inputs.products.find((x) => x.id === chosen && x.role === role);
    if (p) return p;
  }
  return inputs.products.find((x) => x.role === role);
}

function value(inputs: EstimateInputs, key: string, lineKey: string, label: string, issues: Issue[]): number | null {
  const v = inputs.measurements.values[key];
  if (v === null || v === undefined || Number.isNaN(v)) {
    if (!issues.some((i) => i.code === "missing_measurement" && i.message.startsWith(key))) {
      issues.push({ level: "blocking", code: "missing_measurement", lineKey, message: `${key} is not known yet (needed by ${label})` });
    }
    return null;
  }
  if (v < 0) throw new Error(`${key} cannot be negative`);
  return v;
}

function need(coverage: number | null, p: Product): number {
  if (!coverage) throw new Error(`${p.name} has no coverage set`);
  return coverage;
}

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const fmt = (x: number) => x.toLocaleString("en-US", { maximumFractionDigits: 2 });

export type { Trade };
