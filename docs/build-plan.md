# Build plan

The first version is one thin slice through the whole design, running on the
real stack: a report goes in, a person reviews the flags, the four-trade
estimate is edited and approved, and a purchase order goes out through n8n.

## Repository layout

```
engine/            Rule types and the four trade calculators. Pure TypeScript, no I/O
engine/__tests__/  Unit tests with hand-worked answers
reader/            Prompt, JSON schema, the LLM call and the checker that raises flags
supabase/
  migrations/      Tables, row-level security, storage bucket
  seed/            Sample catalog, made-up prices, templates, demo measurements, demo users
app/               Next.js screens and API routes
n8n/               Exported workflows, without credentials
docs/              Architecture, decisions, edge cases
```

## Steps, in order

| # | Step | Done when |
|---|---|---|
| 1 | **Engine.** Six rule types; roofing, gutters, siding, windows; pricing with margin; estimate mode and production mode | `npm test` passes, including one hand-worked case per rule type and per trade |
| 2 | **Database.** Migrations for the tables in the architecture doc, row-level security by role, private `reports` bucket, seed data | A sales user cannot select cost or margin; an admin can |
| 3 | **Screens.** Sign in; job page with measurements and flags; estimate editor (product, waste, labor, margin) with live recalculation; approve; takeoff; purchase order | The demo job can be taken from measurements to an approved purchase order in the browser |
| 4 | **Reader.** Upload a PDF, pull the text per page, call the LLM for fixed JSON, run the checker, store the run in `ai_runs` | The sample report produces the same measurements as the seeded set, with the known flags raised |
| 5 | **Outbox and n8n.** Approving writes outbox rows; one n8n workflow collects them and emails the purchase order; one error workflow alerts on any failure | An approved purchase order arrives by email once, and a forced failure produces an alert |
| 6 | **Deploy.** Vercel project from this repository, environment variables, a check of the whole path on the deployed address | The path in step 3 works on the Vercel address |

## In the first version

- All four trades, on one seeded job from the sample report.
- Flags with three severities; blocking flags stop sending.
- Row-level security for cost and margin.
- Estimate and takeoff from the same engine.
- Purchase order by email through n8n, with a unique key against double sends.
- Event log, AI run log, outbox and audit log tables in use.

## Designed but not built yet

- HOVER API intake (needs developer access).
- CRM and accounting workflows.
- Supplier ordering APIs.
- Good, better, best templates; price import; price-jump alerts.
- Two-step sign-in; estimate versions and change orders.
- Reading scanned PDFs from page images.
- A regression set of past real jobs.

## Testing accuracy

- Unit tests for every rule type with hand-worked answers.
- Reading accuracy measured field by field against hand-keyed values.
- Later: every past job re-run on every change, and a result outside tolerance
  fails the build.
