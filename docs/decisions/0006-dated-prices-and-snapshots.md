# 6. Prices are dated rows, and a sent estimate keeps its snapshot

**Decision.** A price is never edited in place. A change is a new row with a
valid-from date. A sent estimate stores the prices it used.

**Why.** Supplier prices change often. History is automatic, a signed estimate
never changes behind the customer's back, and at order time the system can show
what a price change did to the margin.

**Rejected.** One current price per product, overwritten on change.

**Consequence.** Re-pricing a sent estimate is a deliberate action that creates
a new version.
