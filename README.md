# exterior-estimator

Turns a HOVER measurement report into a customer estimate and a production
material takeoff for four exterior trades: roofing, siding, windows and
gutters. Approved takeoffs become supplier purchase orders.

The whole design hangs on one rule:

**AI reads. Code calculates. People approve.**

- **AI reads** the report and turns it into named numbers, each with the page it
  came from. It never does arithmetic and never fills a gap with a guess.
- **Code calculates** every quantity and price with plain, tested formulas and
  database lookups. Same input, same answer, every time.
- **People approve** at three gates: the measurements, the estimate and the
  purchase order.

A wrong number in an estimate costs real money, either short material on site
or margin given away. So the parts that make numbers are testable code, and AI
is used only where the input is messy.

## Status

First version built on the real stack (Supabase, Next.js on Vercel, n8n): a
report goes in, a person reviews the flags, the four-trade estimate is edited
and approved, and purchase orders go out through n8n. See
[docs/build-plan.md](docs/build-plan.md) for what is in and what is designed
but not built yet. All material prices in this repository are made up.

```
npm install
npm test          # engine and checker, every expected value worked out by hand
npm run dev
```

## Code

| Folder | What it holds |
|---|---|
| [engine/](engine/) | The six rule types, four trades, margin pricing, takeoff. Pure TypeScript, no I/O |
| [reader/](reader/) | Address redaction, the LLM call with fallback models, and the checker that raises flags |
| [supabase/migrations/](supabase/migrations/) | Tables, row-level security, and one database function per business action |
| [app/](app/) | Screens and the outbox API that n8n calls |
| [n8n/](n8n/) | The outbox and error-alert workflows, without credentials |

## Stack

| Part | Choice |
|---|---|
| Database, login, file storage | Postgres on Supabase, with row-level security |
| Web app and API | Next.js (TypeScript) on Vercel |
| Estimating engine | Plain TypeScript functions, unit tested, no AI |
| Report reader | An LLM behind one function, forced to answer in fixed JSON fields |
| Integrations | n8n, fed by an outbox table |

## Where to look

| File | What it is |
|---|---|
| [docs/architecture.md](docs/architecture.md) | The parts, how they talk, the data model and security |
| [docs/decisions/](docs/decisions/) | One short record per architecture decision, with what was rejected and why |
| [docs/edge-cases-and-logging.md](docs/edge-cases-and-logging.md) | What the system does when data is missing, wrong or broken |
| [docs/sample-report-findings.md](docs/sample-report-findings.md) | What a real HOVER report contains and the problems found in it |
| [docs/build-plan.md](docs/build-plan.md) | Build order and what is in or out of the first version |
| [docs/setup.md](docs/setup.md) | How to run it yourself on Supabase, Vercel and n8n |
| [diagrams/architecture.html](diagrams/architecture.html) | Architecture and pipeline diagrams (open in a browser) |

## Reviewing

Comments on the code and the decisions are welcome. Open an issue, or comment
on a commit or pull request.

The sample HOVER report is not in this repository because it shows a real
address. The measurements used in the demo have the address and property IDs
removed.

## License

MIT. See [LICENSE](LICENSE).
