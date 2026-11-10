import type { EstimateResult, MaterialLine } from "./types";

export interface SupplierGroup {
  supplier: string;
  lines: MaterialLine[];
  cost: number;
  /** Lines that cannot be ordered yet, for example windows sized from photos. */
  locked: MaterialLine[];
}

/**
 * Production takeoff: the same material lines, grouped by supplier for
 * purchase orders. Lines for the same product are merged into one order line;
 * each was already rounded up to whole purchase units.
 */
export function takeoff(result: EstimateResult): SupplierGroup[] {
  const groups = new Map<string, SupplierGroup>();
  for (const line of result.materials) {
    const g = groups.get(line.supplier) ?? { supplier: line.supplier, lines: [], cost: 0, locked: [] };
    const same = g.lines.find((l) => l.productId === line.productId);
    if (same) {
      same.quantity += line.quantity;
      same.cost += line.cost;
      same.lockedForPurchase ||= line.lockedForPurchase;
      same.workings += `; ${line.workings}`;
    } else {
      g.lines.push({ ...line, label: line.productName });
    }
    g.cost += line.cost;
    groups.set(line.supplier, g);
  }
  for (const g of groups.values()) g.locked = g.lines.filter((l) => l.lockedForPurchase);
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
