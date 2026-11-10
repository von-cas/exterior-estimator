# Architecture

Five parts, all managed services, no servers to patch. The reasons for each
choice, and what was rejected, are in [decisions/](decisions/).

| Part | Choice | Why this one | How it grows |
|---|---|---|---|
| Database | Postgres on Supabase | Real transactions for many users at once, price history, login, file storage and row-level security in one service | Standard Postgres, so it can move to any host later |
| Web app | Next.js (TypeScript) on Vercel | One codebase for screens and API; deploys from Git; TypeScript catches unit and field mistakes before they ship | Add screens and API routes; scales without server work |
| Estimating engine | Plain TypeScript functions inside the app | No AI, fully unit tested; the estimate and the takeoff come from the same calculation so they cannot disagree | New trade = new data rows; new code only for a new kind of formula |
| Report reader | An LLM behind one function | Turns messy report text into a fixed set of JSON fields | Model and provider are settings |
| Automation | n8n | Low-code layer for CRM, accounting, supplier orders and alerts, where connectors already exist | Each new integration is a workflow, not an app change |

## How the parts talk

1. Staff use the web app in a browser, signed in through Supabase Auth.
2. A HOVER report arrives either from HOVER's API (a "job complete" webhook,
   then the measurements as JSON) or as an uploaded PDF.
3. For a PDF, the app sends the report text to the LLM, page by page, and gets
   named numbers back. With HOVER's JSON there is nothing to read, so no AI is
   involved at all.
4. Code checks the numbers, a person reviews the flags, and the engine
   calculates from the catalog and prices in Postgres.
5. Every business event (estimate sent, estimate approved, purchase order
   approved) is written to an outbox table. n8n collects events and pushes them
   to the CRM, accounting and suppliers. n8n calls the app's API when it needs
   a number. n8n never does math.

## From report to verified measurements

1. **Receive.** Store the original file and its hash, so the same report
   uploaded twice is recognised.
2. **Read.** The LLM returns a fixed JSON shape. Every value carries the page
   it came from. A value that is not in the report comes back empty, never
   estimated.
3. **Check, by code.** Each number must literally appear on the page the LLM
   cited. Totals must agree with their parts. Ranges and units must be sane.
4. **Ask for what HOVER never knows.** Tear-off layers, roof penetrations,
   downspout count, window types. These become a short site checklist, not
   guesses.
5. **Review.** A person clears or corrects each flag. Blocking flags stop the
   estimate from being sent. Corrections are logged with the original value.

## From measurements to estimate, takeoff and purchase order

The engine has a small fixed set of formula kinds. Each template line picks one
and supplies its parameters as data.

| Rule type | Formula | Example |
|---|---|---|
| Area coverage | area × (1 + waste) ÷ coverage, round up | 2,318 sq ft roof, 10% waste, 33.3 sq ft per bundle = 77 bundles of shingles |
| Linear coverage | length × (1 + waste) ÷ piece length, round up | 287 ft of eaves and rakes ÷ 10 ft = 29 pieces of drip edge before waste |
| Per spacing | length ÷ spacing, round up | 176 ft 8 in of gutter, a hanger every 2 ft = 89 hangers |
| Per count | count × quantity each | 34 windows, each with its own flashing, foam and sealant |
| Per item list | one line per measured item | 34 windows in 9 distinct sizes, priced by united inches |
| Fixed | a set quantity per job | Dumpster, permit |

**Pricing.** Cost = material + labor. Selling price = cost ÷ (1 − margin). The
screen says "margin", shows the markup equivalent beside it, and refuses 100%
or more. Each trade has its own margin.

**Changing things without rebuilding.** An estimate stores inputs: verified
measurements, chosen products, waste, labor rates and margins. The lines are
always recalculated from those inputs. Re-pricing a sent estimate is a
deliberate action that creates a new version.

**Production takeoff.** When the estimate is approved, the same calculation
runs in production mode: quantities are converted to purchase units and rounded
up, items the customer never sees are added (nails, sealant), and lines are
grouped by supplier. Same engine, same inputs, so the takeoff cannot drift from
what was sold.

**Purchase orders.** Each supplier group becomes a draft purchase order. A
person approves it. It goes out by email through n8n first, and through a
supplier's ordering API where one exists. Each order carries a unique key so a
retry can never order twice.

## Data model

- `products`: SKU, manufacturer, trade, role (for example `shingle`, `starter`,
  `ridge_cap`), purchase unit and coverage.
- `prices`: product, supplier, cost, valid-from and valid-to dates. A price is
  never edited in place. A change is a new row, so history is automatic.
- `labor_rates`: trade, task, unit, rate, valid dates.
- `templates` and `template_lines`: what a "roof replacement" contains. Each
  line names a product role, a measurement, a rule type and a default waste.
- `estimates` and `estimate_lines`: each sent estimate keeps a snapshot of the
  prices it used, so a later price change never alters a signed estimate.
- `measurement_reports` and `measurements`: every value with its source page
  and who verified it.
- `purchase_orders`, `event_outbox`, `event_log`, `ai_runs`, `audit_log`.

Templates point at product **roles**, not products. A manufacturer's system
fills the roles, so switching manufacturer is one choice, not twenty line edits.

## Security

- Login through Supabase Auth; roles for admin, estimator, sales and production.
- Row-level security in the database: sales sees selling prices, only admin
  and estimators see cost and margin. The customer estimate never contains cost
  or margin.
- Report files sit in a private bucket and are served through short-lived
  signed links.
- Secrets live in the hosts' secret stores, never in code.
- The LLM call gets report text only and has no tools. Text inside a document
  is treated as data, so a document cannot instruct the model to do anything.
- An audit log of who changed what.

## Built to grow

| Need | How this design handles it |
|---|---|
| More trades | A trade is rows: measurements it uses, a template, products. Code changes only if it needs a new rule type |
| More manufacturers and catalogs | Product roles plus manufacturer systems; catalogs imported from supplier files or APIs |
| Price changes | Dated price rows, bulk import, alert on big jumps, estimates keep their snapshot |
| Different estimating templates | Templates are data: good, better, best, or per salesperson |
| CRM and accounting | Outbox events to n8n; the app stays unaware of which CRM |
| Many employees at once | Postgres transactions, a version number on each estimate so two people cannot overwrite each other, roles |
| Future automation | Each stage emits an event, so new automations subscribe without changing the core |
