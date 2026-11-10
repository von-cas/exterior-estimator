import type { SupabaseClient } from "@supabase/supabase-js";
import {
  calculate, withDerived, TRADES,
  type EstimateInputs, type EstimateResult, type LaborLine, type LaborRate, type Measurements, type Product, type TemplateLine, type Trade,
} from "@/engine";

export interface Choices {
  trades: Trade[];
  selections: Record<string, string>;
  wasteOverrides: Record<string, number>;
  margins: Record<Trade, number>;
}

export async function loadMeasurements(sb: SupabaseClient, reportId: string): Promise<Measurements> {
  const [{ data: rows, error }, { data: windows, error: e2 }] = await Promise.all([
    sb.from("measurements").select("key, value").eq("report_id", reportId),
    sb.from("measurement_windows").select("width, height, count").eq("report_id", reportId),
  ]);
  if (error || e2) throw new Error((error ?? e2)!.message);
  const values: Record<string, number | null> = {};
  for (const r of rows!) values[r.key] = r.value === null ? null : Number(r.value);
  return withDerived({ values, windows: windows!.map((w) => ({ width: Number(w.width), height: Number(w.height), count: w.count })) });
}

/** Catalog with current prices. Needs a role that can read costs. */
export async function loadCatalog(sb: SupabaseClient) {
  const [tl, lab, prod, rates, tpl] = await Promise.all([
    sb.from("template_lines").select("*, templates(trade)").order("sort"),
    sb.from("template_labor").select("*, templates(trade)").order("sort"),
    sb.from("products").select("*, prices(supplier, unit_cost, valid_to)").eq("active", true).order("sku"),
    sb.from("labor_rates").select("*").is("valid_to", null),
    sb.from("templates").select("trade, default_margin"),
  ]);
  for (const r of [tl, lab, prod, rates, tpl]) if (r.error) throw new Error(r.error.message);

  const template: TemplateLine[] = tl.data!.map((l) => ({
    key: l.key, trade: l.templates.trade, role: l.role, label: l.label, rule: l.rule,
    measurement: l.measurement ?? undefined, waste: num(l.waste), spacing: num(l.spacing), qtyEach: num(l.qty_each),
    quantity: num(l.quantity), bands: l.bands ?? undefined, productionOnly: l.production_only,
  }));
  const labor: LaborLine[] = lab.data!.map((l) => ({
    key: l.key, trade: l.templates.trade, task: l.task, label: l.label, measurement: l.measurement, per: num(l.per), times: l.times ?? undefined,
  }));
  const products: Product[] = [];
  for (const p of prod.data!) {
    const price = (p.prices as { supplier: string; unit_cost: number; valid_to: string | null }[]).find((x) => x.valid_to === null);
    if (!price) continue; // no current price: the engine raises "no product" for the role
    products.push({ id: p.id, sku: p.sku, name: p.name, trade: p.trade, role: p.role, unit: p.unit, coverage: p.coverage === null ? null : Number(p.coverage), supplier: price.supplier, unitCost: price.unit_cost });
  }
  const laborRates: LaborRate[] = rates.data!.map((r) => ({ trade: r.trade, task: r.task, unit: r.unit, rate: r.rate }));
  const margins = Object.fromEntries(TRADES.map((t) => [t, Number(tpl.data!.find((x) => x.trade === t)?.default_margin ?? 0.35)])) as Record<Trade, number>;
  return { template, labor, products, laborRates, margins };
}

export type Catalog = Awaited<ReturnType<typeof loadCatalog>>;

export function buildInputs(catalog: Catalog, measurements: Measurements, choices: Choices): EstimateInputs {
  return {
    trades: TRADES.filter((t) => choices.trades.includes(t)),
    measurements, template: catalog.template, labor: catalog.labor, products: catalog.products, laborRates: catalog.laborRates,
    selections: choices.selections, wasteOverrides: choices.wasteOverrides, margins: { ...catalog.margins, ...choices.margins },
  };
}

export function pricesUsed(result: EstimateResult) {
  const seen = new Map<string, { sku: string; supplier: string; unitCost: number }>();
  for (const m of result.materials) seen.set(m.productId, { sku: m.sku, supplier: m.supplier, unitCost: m.unitCost });
  return Object.fromEntries(seen);
}

export function run(catalog: Catalog, measurements: Measurements, choices: Choices) {
  return calculate(buildInputs(catalog, measurements, choices));
}

const num = (x: unknown) => (x === null || x === undefined ? undefined : Number(x));
