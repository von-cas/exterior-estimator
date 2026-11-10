# 4. n8n at the edges, fed by an outbox it collects from

**Decision.** The app writes each business event to an `event_outbox` table.
n8n asks the app for pending events on a schedule, does the outside work
(email a purchase order, update a CRM), and reports back success or failure.
n8n never calculates.

**Why.** Connectors for CRMs, accounting and email already exist in n8n, so
each integration is a workflow and not an app change. Because n8n collects
events instead of receiving them, it needs no public address, and if n8n is
down the events wait instead of being lost. Each event has a unique key, so a
retry cannot send twice.

**Rejected.** The app calling n8n webhooks directly: an event is lost if n8n is
unreachable at that moment, and n8n must be exposed to the internet. Putting
formulas in n8n: they cannot be unit tested there.

**Consequence.** Events arrive up to one schedule interval late. That is fine
for orders and CRM updates.
