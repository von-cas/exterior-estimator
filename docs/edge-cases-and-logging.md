# Edge cases and error logging

How the estimator behaves when something is missing, wrong or
broken. The rule behind all of it: **never a silent number**. The system flags
and waits; it does not guess and it does not quietly fall back to a default.

Severity: **Blocker** stops the estimate or order from going out. **Warning**
lets it go out after a named person acknowledges it. **Note** is recorded only.

"Demo" marks the cases the demo shows live on the sample report.

## 1. The document itself

| # | Case | What the system does | Severity | Demo |
|---|---|---|---|---|
| D1 | File is not a PDF, is too large, or is not a HOVER report | Rejected at upload with a plain message; nothing is sent to the AI | Blocker | |
| D2 | Scanned or image-only PDF, no text layer | Read from page images; the "value appears on the page" check is skipped and every value is marked for review | Warning | |
| D3 | Text layer is garbled or doubled | Each value carries its page; code confirms the value on that page; disagreements are flagged | Warning | Yes |
| D4 | Same report uploaded twice | Recognised by file hash and HOVER property ID; the user is taken to the existing job | Note | |
| D5 | Roof-only report used for a four-trade estimate | Trades with no measurements are switched off with the reason shown | Warning | |
| D6 | HOVER changes its report layout | Reading is by field meaning, not page position; the field-by-field accuracy test catches a drop before users do | Warning | |
| D7 | Property has more than one building | Each structure becomes its own measurement set; the estimator chooses which are in scope | Warning | |
| D8 | Report is old | Report date is stored; older than a set age raises a warning to confirm the house is unchanged | Warning | Yes |
| D9 | Text in the PDF tries to instruct the AI | The reader has no tools and can only return the fixed number fields; text in a document is data | Note | |

## 2. Units and formats

| # | Case | What the system does | Severity | Demo |
|---|---|---|---|---|
| U1 | Feet and inches such as `193' 11"` | Converted once at intake to decimal feet; the original text is kept beside it | Note | Yes |
| U2 | Fractions such as `25¼` squares | Parsed; cross-checked against area ÷ 100 | Note | |
| U3 | A dash in a cell | Stored as "not given", never as zero, unless the row is a count that HOVER states as zero | Warning | |
| U4 | Non-numeric values such as stories `>1` | Stored as text with a question for the estimator; anything depending on it is flagged | Warning | Yes |
| U5 | Area unit confusion (sq ft vs squares) | Every measurement has a declared unit; the engine refuses to combine mismatched units | Blocker | |

## 3. Measurements that disagree or are missing

| # | Case | What the system does | Severity | Demo |
|---|---|---|---|---|
| M1 | Parts do not add up to the total beyond rounding | Flag with both numbers shown | Warning | Yes |
| M2 | Parts differ from the total only by rounding | Accepted; difference recorded | Note | Yes |
| M3 | HOVER totals that remove shared segments | Checker knows which totals behave this way and does not false-alarm | Note | Yes |
| M4 | Counts disagree between pages (openings: 30, 29, 37) | Flag; a person chooses and the choice is logged | Warning | Yes |
| M5 | A value is outside a sane range | Flag; the engine will not calculate from it until confirmed | Blocker | |
| M6 | A measurement a trade needs is absent | That line shows "needs input" instead of a quantity | Blocker | |
| M7 | Roof pitch is steep or low | Steep adds a labor factor; low slope changes the allowed products; both are shown as reasons on the line | Note | |
| M8 | No valleys (or any zero) | A stated zero is trusted; a missing value is not | Note | Yes |
| M9 | Brick or other non-siding facades | Excluded from siding area by material | Note | Yes |
| M10 | Openings over 33 sq ft (garage door) | Handled by the same rule HOVER uses before comparing counts and areas | Note | Yes |
| M11 | Things HOVER never measures (tear-off layers, penetrations, downspouts, window types) | A site checklist per trade; unanswered items show as assumptions on the estimate or block ordering | Warning or Blocker | Yes |
| M12 | Window sizes from photos | Usable for pricing; purchasing is locked until a field measure is recorded | Blocker for ordering | Yes |
| M13 | A person corrects a measurement | Original and corrected values, who and when, are kept; dependent lines recalculate | Note | |

## 4. Catalog and pricing

| # | Case | What the system does | Severity | Demo |
|---|---|---|---|---|
| P1 | Product has no current price | Line shows "no price"; estimate cannot be sent | Blocker | |
| P2 | Price has expired | Warning with the age of the price | Warning | |
| P3 | Product discontinued | Cannot be added to new estimates; existing ones show a replacement prompt | Warning | |
| P4 | Coverage or purchase unit missing on a product | Engine refuses the line rather than assume | Blocker | |
| P5 | Quantity comes out zero or negative | Flag; never ordered | Blocker | |
| P6 | Rounding | Quantities always round up to the purchase unit, after waste, once | Note | Yes |
| P7 | Minimum order quantities and pack sizes | Applied in production mode; the extra is shown | Note | |
| P8 | Margin of 100% or more, or negative | Refused at entry | Blocker | Yes |
| P9 | Margin confused with markup | Both shown side by side | Note | Yes |
| P10 | Price changes after the estimate is sent | Sent estimate keeps its snapshot; at order time the system shows the margin effect and asks | Warning | |
| P11 | Supplier price import has a large jump | Held for review instead of applied | Warning | |
| P12 | Sales tax | A setting per job type and state, applied in one place | Note | |

## 5. People and workflow

| # | Case | What the system does | Severity | Demo |
|---|---|---|---|---|
| W1 | Two people edit the same estimate | Each save carries a version number; the second saver is told and shown the difference | Warning | |
| W2 | Measurement changes after approval | Estimate and takeoff are marked out of date; a new version is required | Blocker | |
| W3 | Purchase order sent twice | Each PO has a unique key; a repeat is ignored and logged | Note | |
| W4 | Someone without the role tries to see cost or margin | Blocked in the database, not just hidden on screen | Blocker | |
| W5 | Estimate approved but a trade is removed later | Change order creates a new version; the old one stays on record | Note | |

## 6. Outside systems

| # | Case | What the system does | Severity | Demo |
|---|---|---|---|---|
| X1 | AI service is down, slow or rate limited | Retry with growing waits; then the job waits in a queue and the user can key the measurements by hand | Warning | |
| X2 | AI returns the wrong shape | Rejected by the schema, retried once, then sent to a person | Warning | |
| X3 | CRM, accounting or supplier call fails | The outbox row stays pending and is retried; after a set number of tries it is parked and alerted | Warning | |
| X4 | Part of a multi-step sync succeeds | Each step is its own outbox row, so only the failed step repeats | Note | |
| X5 | HOVER sends the same webhook twice | Ignored by event ID | Note | |
| X6 | n8n itself is down | Events wait in the outbox; nothing is lost; a heartbeat check alerts | Warning | |

## Error logging design

Four records, each with one job. All of them live in Postgres so one query can
follow a job from upload to purchase order.

| Record | One row per | Holds | Used for |
|---|---|---|---|
| `event_log` | Thing that happened | Time, level, source (app, engine, AI, n8n, integration), event type, job and estimate IDs, a trace ID shared across systems, user, message, details | Finding what went wrong and when |
| `ai_runs` | AI call | Model, prompt version, file hash, tokens, time taken, the output, the check results | Measuring reading accuracy and cost; replaying a bad read |
| `event_outbox` | Outgoing action | Target, payload, status (pending, sent, failed, parked), attempts, last error, unique key | Retries without duplicates |
| `audit_log` | Change by a person | Who, when, which field, old value, new value | Answering "who changed this price?" |

Rules:

- **No secrets and no customer contact details in logs.** IDs only.
- **One trace ID** follows a job through the app, n8n and the supplier call.
- **Every failure alerts**, including repeats. Healthy runs stay quiet. Alerts
  go to one channel through an n8n error workflow, with a daily summary of
  anything still parked.
- **Errors shown to users say what happened and what to do next**, in plain
  words, with the trace ID for support.
- **The engine never catches an error and returns a number anyway.** A line
  either has a quantity with its working shown, or it has a flag.

In the demo build, the event log is a table in Postgres and the flags panel is
the visible part of this design.
