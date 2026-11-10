# What is in the HOVER report

Read from a real HOVER "Complete Measurements" report of 27 pages for a house
of more than one storey in Minnesota. The report itself is not in this
repository because it shows a real address. Property IDs and the report date
are left out for the same reason.

Numbers below were read from the PDF's text and checked by a script against
the report's own totals.

## Measurements the estimate will use

### Roof (pages 22 to 26)

| Measure | Value |
|---|---|
| Roof area | 2,318 sq ft, 12 facets |
| Pitch | 5/12 on 100% of the roof |
| Ridges | 75 ft 6 in |
| Hips | 14 ft 7 in |
| Ridges plus hips | 90 ft 1 in |
| Valleys | none |
| Rakes | 110 ft 5 in |
| Eaves (gutter line) | 176 ft 8 in, 12 segments |
| Flashing | 5 ft 10 in |
| Step flashing | 72 ft 2 in |
| HOVER waste table | 2,434 sq ft at 5%, 2,550 at 10%, 2,666 at 15%, 2,782 at 20% |

### Siding (pages 2, 12 to 18)

| Measure | Value |
|---|---|
| Siding area | 2,513 sq ft over 26 facades |
| Other material (brick) | 126 sq ft over 4 facades, not to be sided |
| Level starter | 193 ft 11 in |
| Sloped trim | 81 ft 3 in |
| Vertical trim | 155 ft 4 in |
| Inside corners | 12, total 76 ft 11 in |
| Outside corners | 12, total 145 ft 6 in |
| Opening tops, sills, sides | 88 ft 3 in, 64 ft 6 in, 149 ft |
| Level frieze board | 187 ft 2 in on the summary page (179 ft 1 in in the siding table) |
| Sloped frieze board | 91 ft 10 in |
| Soffit | 457 sq ft level (average depth 2 ft 5 in), 92 sq ft sloped |
| Shutters | 6, total 27 sq ft |
| HOVER waste table | 2,767 sq ft at 10%, 2,965 at 18% |

### Windows and doors (pages 19 to 21)

34 windows, 2,546 united inches, 300 sq ft. Nine distinct sizes:

| Width × height (in) | United inches | Count |
|---|---|---|
| 26 × 46 | 72 | 9 |
| 23 × 64 | 87 | 5 |
| 34 × 43 | 77 | 5 |
| 21 × 39 | 60 | 4 |
| 27 × 40 | 67 | 4 |
| 26 × 54 | 80 | 3 |
| 47 × 43 | 90 | 2 |
| 29 × 64 | 93 | 1 |
| 37 × 20 | 57 | 1 |

4 doors: 36 × 82, 32 × 80, 36 × 82, and one 192 × 84 (a garage door, 112 sq ft).

### Gutters

HOVER gives only the eave length: 176 ft 8 in over 12 segments. It gives no
downspout count, no downspout positions, no corner (miter) count and no exact
storey count ("Number of Stories: >1").

## Checks the report passes

| Check | Result |
|---|---|
| Ridges + hips = stated total | 75 ft 6 in + 14 ft 7 in = 90 ft 1 in. Agrees |
| Siding facade areas add up to the total | 26 facades sum to 2,513 sq ft. Agrees |
| Window united inches add up | 34 windows sum to 2,546 in. Agrees |
| Each window's united inches = width + height | All 34 agree |
| Roof facets add up to the total | Facets sum to 2,315 sq ft, total says 2,318. 3 sq ft apart, explained by each facet being rounded. Inside tolerance |
| Roof waste table = area × factor | Agrees |

## Problems found (these are the demo's "flag, don't invent" examples)

1. **The PDF's text layer is doubled and garbled.** Words repeat and overlap,
   two different property IDs appear, and page numbers
   print twice with different values. A simple text scraper would read
   nonsense in places. This is why the reader returns a page reference for
   every value and why code checks each value against the page.

2. **Opening counts disagree.** The summary page says 30 siding openings plus
   1 other. The facade table adds up to 29 plus 1. The openings pages list 34
   windows and 4 doors, which is 37 after leaving out the garage door. The
   system must not pick one. It raises a warning and a person decides. The
   likely cause is that windows mulled together count as one opening, but that
   is my guess, so it stays a flag.

3. **Level frieze board has two values.** 187 ft 2 in on the summary page and
   179 ft 1 in in the siding table. The summary figure may cover the whole
   house and the table only the sided walls, but the report does not say, so
   it is a flag for review.

4. **Table columns do not add up to their totals, on purpose.** The siding
   table's footnote says totals remove segments shared between facades. So a
   naive "sum the column" check would raise false alarms. The checker uses the
   stated total and only confirms it is not larger than the column sum. The
   same applies to corner counts: 23 inside and 19 outside when counted per
   facade, 12 and 12 in the summary.

5. **Window sizes come from photos.** They are good enough to price and not
   good enough to order. Window lines stay locked for purchasing until a field
   measure is recorded. The report also gives no window type (double-hung,
   casement, slider), no egress or tempered-glass information.

6. **Openings over 33 sq ft are left out of HOVER's opening totals** (footnote
   on the summary page). The garage door is one. The checker has to apply the
   same rule before comparing.

7. **Things HOVER does not measure at all**, needed for a real estimate:
   layers to tear off, decking condition, pipe boots, vents, skylights,
   chimney flashing (the four small brick facades may be a chimney), downspout
   count and positions, gutter corners, exact storey height.

8. **The report is several years old.** A real job should confirm the house has not
   changed. The system records the report date and warns when it is old.
