# 2. Postgres is the core, not a low-code table

**Decision.** Catalog, prices, templates, estimates and logs live in Postgres
on Supabase.

**Why.** Two estimators can edit at once without overwriting each other. Price
history comes from dated rows. Row-level security keeps cost and margin away
from roles that should not see them, in the database and not only on screen.
Login and file storage come in the same service.

**Rejected.** n8n or Make plus Airtable for everything. It starts fast, but it
is weak when two people edit one job, has no real price history, and scatters
formulas across workflow steps that cannot be tested.

**Consequence.** It is standard Postgres, so it can move to another host.
