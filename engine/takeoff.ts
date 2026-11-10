import type { EstimateResult, MaterialLine } from "./types";

export interface SupplierGroup {
  supplier: string;
  lines: MaterialLine[];
  cost: number;
  /** Lines that cannot be ordered yet, for example windows sized from photos. */
  locked: MaterialLine[];
}

/** Production takeoff: the same material lines, grouped by supplier for purchase orders. */
export function takeoff(result: EstimateResult): SupplierGroup[] {
  const groups = new Map<string, SupplierGroup>();
  for (const line of result.materials) {
    const g = groups.get(line.supplier) ?? { supplier: line.supplier, lines: [], cost: 0, locked: [] };
    g.lines.push(line);
    g.cost += line.cost;
    if (line.lockedForPurchase) g.locked.push(line);
    groups.set(line.supplier, g);
  }
  return [...groups.values()].sort((a, b) => a.supplier.localeCompare(b.supplier));
}

/** What the customer sees: one price per trade, no cost, margin or production-only lines. */
export function customerView(result: EstimateResult) {
  return {
    trades: result.trades.map((t) => ({
      trade: t.trade,
      price: t.price,
      items: result.materials.filter((m) => m.trade === t.trade && !m.productionOnly).map((m) => m.label),
    })),
    total: result.totalPrice,
  };
}
