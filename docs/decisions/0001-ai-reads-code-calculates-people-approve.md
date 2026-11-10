# 1. AI reads, code calculates, people approve

**Decision.** The LLM only turns a report into named numbers. Every quantity
and price is calculated by plain code. A person approves the measurements, the
estimate and each purchase order.

**Why.** A wrong number costs real money: short material on site, or margin
given away. Code gives the same answer for the same input and each line can
show its working. An LLM does neither reliably.

**Rejected.** Letting the LLM produce the estimate directly. It makes a fast
demo, but the numbers are not repeatable and nobody can audit a line.

**Consequence.** When the measurements arrive as JSON from HOVER's API, no AI
runs at all.
