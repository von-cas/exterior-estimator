/** Selling price from cost and gross margin: price = cost ÷ (1 − margin). Cents in, cents out. */
export function priceFromMargin(cost: number, margin: number): number {
  assertMargin(margin);
  return Math.round(cost / (1 - margin));
}

/** The markup that gives the same price: margin ÷ (1 − margin). 35% margin = 53.8% markup. */
export function markupFromMargin(margin: number): number {
  assertMargin(margin);
  return margin / (1 - margin);
}

export function assertMargin(margin: number) {
  if (!(margin >= 0 && margin < 1)) {
    throw new Error("margin must be at least 0% and below 100%");
  }
}
