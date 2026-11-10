import type { RuleType } from "./types";

// Floating point turns 77.0 into 77.00000000001; never order an extra unit for that.
const EPS = 1e-9;
export const roundUp = (x: number) => Math.ceil(x - EPS);

export interface RuleResult {
  quantity: number;
  workings: string;
}

const n = (x: number, digits = 2) =>
  x.toLocaleString("en-US", { maximumFractionDigits: digits });

/** Area coverage: area × (1 + waste) ÷ coverage, round up. */
export function areaCoverage(area: number, waste: number, coverage: number): RuleResult {
  assertPositive(coverage, "coverage");
  assertWaste(waste);
  const raw = (area * (1 + waste)) / coverage;
  return {
    quantity: roundUp(raw),
    workings: `${n(area)} sq ft × ${n(1 + waste)} ÷ ${n(coverage)} = ${n(raw)} → ${roundUp(raw)}`,
  };
}

/** Linear coverage: length × (1 + waste) ÷ piece length, round up. */
export function linearCoverage(length: number, waste: number, pieceLength: number): RuleResult {
  assertPositive(pieceLength, "piece length");
  assertWaste(waste);
  const raw = (length * (1 + waste)) / pieceLength;
  return {
    quantity: roundUp(raw),
    workings: `${n(length)} ft × ${n(1 + waste)} ÷ ${n(pieceLength)} = ${n(raw)} → ${roundUp(raw)}`,
  };
}

/** Per spacing: length ÷ spacing, round up. */
export function perSpacing(length: number, spacing: number): RuleResult {
  assertPositive(spacing, "spacing");
  const raw = length / spacing;
  return {
    quantity: roundUp(raw),
    workings: `${n(length)} ft ÷ ${n(spacing)} ft = ${n(raw)} → ${roundUp(raw)}`,
  };
}

/** Per count: count × quantity each. */
export function perCount(count: number, qtyEach: number): RuleResult {
  const raw = count * qtyEach;
  return { quantity: roundUp(raw), workings: `${n(count)} × ${n(qtyEach)} = ${n(raw)}` };
}

/** Fixed: a set quantity per job. */
export function fixed(quantity: number): RuleResult {
  return { quantity, workings: `${n(quantity)} per job` };
}

export const unitedInches = (width: number, height: number) => width + height;

function assertPositive(x: number, what: string) {
  if (!(x > 0)) throw new Error(`${what} must be greater than zero`);
}
function assertWaste(w: number) {
  if (!(w >= 0 && w < 1)) throw new Error("waste must be between 0% and 100%");
}

export const RULE_TYPES: RuleType[] = ["area", "linear", "per_spacing", "per_count", "per_item", "fixed"];
