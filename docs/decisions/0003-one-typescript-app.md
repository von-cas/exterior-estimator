# 3. One TypeScript app, with the engine as pure functions

**Decision.** Screens and API are one Next.js app on Vercel. The estimating
engine is a folder of pure TypeScript functions with no database or network
calls: measurements, template, catalog and settings go in; lines come out.

**Why.** One codebase and one deploy. Pure functions are easy to test against
hand-worked answers. The customer estimate and the production takeoff call the
same function in two modes, so they cannot disagree.

**Rejected.** A Python backend plus a separate React frontend. It works, but it
is two codebases and more hosting for the same result.

**Consequence.** A new trade is new data rows. New code is needed only for a
new kind of formula.
