import type { Measurements } from "./types";

/**
 * Values the engine needs that are sums of measured values. Each one is null
 * unless every part is known, so a missing part can never turn into zero.
 */
export const DERIVED: Record<string, { parts: string[]; label: string; calc: (v: number[]) => number }> = {
  eaves_and_rakes: { parts: ["eaves", "rakes"], label: "Eaves + rakes", calc: ([a, b]) => a + b },
  opening_trim: { parts: ["opening_tops", "opening_sills", "opening_sides"], label: "Opening trim", calc: (v) => v.reduce((a, b) => a + b, 0) },
  soffit_total: { parts: ["soffit_level", "soffit_sloped"], label: "Soffit total", calc: ([a, b]) => a + b },
  downspout_length: { parts: ["downspouts", "eave_height"], label: "Downspout length", calc: ([n, h]) => n * h },
};

export function withDerived(m: Measurements): Measurements {
  const values = { ...m.values };
  for (const [key, d] of Object.entries(DERIVED)) {
    const parts = d.parts.map((p) => values[p]);
    values[key] = parts.every((p) => typeof p === "number" && !Number.isNaN(p)) ? round(d.calc(parts as number[])) : null;
  }
  values.window_count = m.windows.reduce((s, w) => s + w.count, 0);
  return { ...m, values };
}

const round = (x: number) => Math.round(x * 10000) / 10000;
