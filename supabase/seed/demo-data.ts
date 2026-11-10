// Demo catalog, templates and measurements. ALL PRICES ARE MADE UP.
// Measurements are from the sample HOVER report with the address and property
// IDs removed (see docs/sample-report-findings.md). Feet are decimal feet.
import type { LaborLine, LaborRate, Measurements, Product, TemplateLine, Trade, WindowItem } from "../../engine";

const ft = (feet: number, inches = 0) => Math.round((feet + inches / 12) * 10000) / 10000;

export const SUPPLIERS = {
  roofing: "North Roofing Supply (demo)",
  siding: "Lakeside Siding Co (demo)",
  windows: "Clearview Windows (demo)",
} as const;

let n = 0;
const p = (trade: Trade, role: string, sku: string, name: string, unit: string, coverage: number | null, dollars: number, supplier: string): Product =>
  ({ id: `demo-${++n}`, trade, role, sku, name, unit, coverage, supplier, unitCost: Math.round(dollars * 100) });

export const PRODUCTS: Product[] = [
  // Roofing
  p("roofing", "shingle", "SH-ARCH-CHR", "Architectural shingle, Charcoal", "bundle", 33.3, 38.5, SUPPLIERS.roofing),
  p("roofing", "shingle", "SH-ARCH-WWD", "Architectural shingle, Weathered Wood", "bundle", 33.3, 38.5, SUPPLIERS.roofing),
  p("roofing", "shingle", "SH-DES-SLT", "Designer shingle, Slate", "bundle", 25, 61, SUPPLIERS.roofing),
  p("roofing", "starter", "ST-105", "Starter strip", "bundle", 105, 52, SUPPLIERS.roofing),
  p("roofing", "ridge_cap", "RC-33", "Hip and ridge cap", "bundle", 33, 68, SUPPLIERS.roofing),
  p("roofing", "underlayment", "UL-SYN-10", "Synthetic underlayment, 10 sq roll", "roll", 1000, 112, SUPPLIERS.roofing),
  p("roofing", "ice_water", "IW-200", "Ice and water shield, 3 × 66.7 ft", "roll", 66.7, 98, SUPPLIERS.roofing),
  p("roofing", "drip_edge", "DE-10-WHT", "Drip edge, white, 10 ft", "piece", 10, 9.25, SUPPLIERS.roofing),
  p("roofing", "step_flashing", "SF-4X4-100", "Step flashing 4 × 4 × 8 in, box of 100", "box", 58, 41, SUPPLIERS.roofing),
  p("roofing", "pipe_boot", "PB-3IN", "Pipe boot, 3 in", "each", null, 14.5, SUPPLIERS.roofing),
  p("roofing", "roof_nails", "NL-COIL-125", "Coil roofing nails 1.25 in, box", "box", 1800, 46, SUPPLIERS.roofing),
  p("roofing", "dumpster", "SV-DUMP-20", "Dumpster, 20 yd", "each", null, 450, SUPPLIERS.roofing),
  // Siding
  p("siding", "siding_panel", "VS-D4-WHT", "Vinyl siding D4, White", "square", 100, 165, SUPPLIERS.siding),
  p("siding", "siding_panel", "VS-D4-CLY", "Vinyl siding D4, Clay", "square", 100, 172, SUPPLIERS.siding),
  p("siding", "siding_starter", "VS-STR-12", "Siding starter strip, 12 ft", "piece", 12, 8.4, SUPPLIERS.siding),
  p("siding", "outside_corner", "VS-OC-10", "Outside corner post, 10 ft", "piece", 10, 31, SUPPLIERS.siding),
  p("siding", "inside_corner", "VS-IC-10", "Inside corner, 10 ft", "piece", 10, 17.5, SUPPLIERS.siding),
  p("siding", "j_channel", "VS-JC-125", "J-channel, 12.5 ft", "piece", 12.5, 7.8, SUPPLIERS.siding),
  p("siding", "house_wrap", "HW-9X111", "House wrap, 9 × 111 ft", "roll", 999, 165, SUPPLIERS.siding),
  p("siding", "soffit", "SO-VNT-16", "Vented soffit panel, 16 sq ft", "piece", 16, 21, SUPPLIERS.siding),
  p("siding", "frieze", "FR-12-WHT", "Frieze board, 12 ft", "piece", 12, 24, SUPPLIERS.siding),
  p("siding", "siding_nails", "NL-SID-5LB", "Siding nails, 5 lb box", "box", 800, 18, SUPPLIERS.siding),
  // Windows: priced by united inches (width + height)
  p("windows", "window_ui_75", "WN-DH-75", "Double-hung vinyl window up to 75 UI", "each", null, 285, SUPPLIERS.windows),
  p("windows", "window_ui_90", "WN-DH-90", "Double-hung vinyl window 76 to 90 UI", "each", null, 340, SUPPLIERS.windows),
  p("windows", "window_ui_101", "WN-DH-101", "Double-hung vinyl window 91 to 101 UI", "each", null, 395, SUPPLIERS.windows),
  p("windows", "window_install_kit", "WN-KIT", "Install kit: flashing tape, foam, sealant", "kit", null, 22, SUPPLIERS.windows),
  // Gutters
  p("gutters", "gutter", "GT-K5-WHT", "Seamless K-style gutter 5 in, white", "ft", 1, 3.1, SUPPLIERS.roofing),
  p("gutters", "hanger", "GT-HNG-5", "Hidden hanger 5 in", "each", null, 1.35, SUPPLIERS.roofing),
  p("gutters", "downspout", "DS-2X3-10", "Downspout 2 × 3 in, 10 ft", "piece", 10, 11.5, SUPPLIERS.roofing),
  p("gutters", "outlet", "GT-OUT-5", "Gutter outlet", "each", null, 4.2, SUPPLIERS.roofing),
  p("gutters", "corner", "GT-MIT-5", "Gutter miter corner", "each", null, 16, SUPPLIERS.roofing),
  p("gutters", "gutter_sealant", "GT-SEAL", "Gutter sealant tube", "tube", null, 7.5, SUPPLIERS.roofing),
];

export const TEMPLATE: TemplateLine[] = [
  { key: "roof.shingles", trade: "roofing", role: "shingle", label: "Shingles", rule: "area", measurement: "roof_area", waste: 0.1 },
  { key: "roof.underlayment", trade: "roofing", role: "underlayment", label: "Synthetic underlayment", rule: "area", measurement: "roof_area", waste: 0.1 },
  { key: "roof.ice_water", trade: "roofing", role: "ice_water", label: "Ice and water shield at eaves", rule: "linear", measurement: "eaves", waste: 0.05 },
  { key: "roof.starter", trade: "roofing", role: "starter", label: "Starter strip", rule: "linear", measurement: "eaves_and_rakes", waste: 0.05 },
  { key: "roof.ridge", trade: "roofing", role: "ridge_cap", label: "Hip and ridge cap", rule: "linear", measurement: "ridges_hips", waste: 0.05 },
  { key: "roof.drip_edge", trade: "roofing", role: "drip_edge", label: "Drip edge", rule: "linear", measurement: "eaves_and_rakes", waste: 0 },
  { key: "roof.step_flashing", trade: "roofing", role: "step_flashing", label: "Step flashing", rule: "linear", measurement: "step_flashing", waste: 0.1 },
  { key: "roof.pipe_boots", trade: "roofing", role: "pipe_boot", label: "Pipe boots", rule: "per_count", measurement: "pipe_boots", qtyEach: 1 },
  { key: "roof.nails", trade: "roofing", role: "roof_nails", label: "Roofing nails", rule: "area", measurement: "roof_area", waste: 0.1, productionOnly: true },
  { key: "roof.dumpster", trade: "roofing", role: "dumpster", label: "Dumpster", rule: "fixed", quantity: 1 },

  { key: "siding.panels", trade: "siding", role: "siding_panel", label: "Siding", rule: "area", measurement: "siding_area", waste: 0.1 },
  { key: "siding.wrap", trade: "siding", role: "house_wrap", label: "House wrap", rule: "area", measurement: "siding_area", waste: 0.1 },
  { key: "siding.starter", trade: "siding", role: "siding_starter", label: "Starter strip", rule: "linear", measurement: "level_starter", waste: 0.05 },
  { key: "siding.outside_corners", trade: "siding", role: "outside_corner", label: "Outside corners", rule: "linear", measurement: "outside_corners_length", waste: 0.05 },
  { key: "siding.inside_corners", trade: "siding", role: "inside_corner", label: "Inside corners", rule: "linear", measurement: "inside_corners_length", waste: 0.05 },
  { key: "siding.j_channel", trade: "siding", role: "j_channel", label: "J-channel around openings", rule: "linear", measurement: "opening_trim", waste: 0.1 },
  { key: "siding.soffit", trade: "siding", role: "soffit", label: "Soffit", rule: "area", measurement: "soffit_total", waste: 0.1 },
  { key: "siding.frieze", trade: "siding", role: "frieze", label: "Frieze board", rule: "linear", measurement: "frieze_level", waste: 0.1 },
  { key: "siding.nails", trade: "siding", role: "siding_nails", label: "Siding nails", rule: "area", measurement: "siding_area", waste: 0.1, productionOnly: true },

  {
    key: "windows.units", trade: "windows", role: "window", label: "Window", rule: "per_item",
    bands: [{ maxUnitedInches: 75, role: "window_ui_75" }, { maxUnitedInches: 90, role: "window_ui_90" }, { maxUnitedInches: 101, role: "window_ui_101" }],
  },
  { key: "windows.kits", trade: "windows", role: "window_install_kit", label: "Install kits", rule: "per_count", measurement: "window_count", qtyEach: 1, productionOnly: true },

  { key: "gutters.gutter", trade: "gutters", role: "gutter", label: "Seamless gutter", rule: "linear", measurement: "eaves", waste: 0.05 },
  { key: "gutters.hangers", trade: "gutters", role: "hanger", label: "Hangers every 2 ft", rule: "per_spacing", measurement: "eaves", spacing: 2 },
  { key: "gutters.downspouts", trade: "gutters", role: "downspout", label: "Downspouts", rule: "linear", measurement: "downspout_length", waste: 0.1 },
  { key: "gutters.outlets", trade: "gutters", role: "outlet", label: "Outlets", rule: "per_count", measurement: "downspouts", qtyEach: 1 },
  { key: "gutters.corners", trade: "gutters", role: "corner", label: "Corners", rule: "per_count", measurement: "gutter_corners", qtyEach: 1 },
  { key: "gutters.sealant", trade: "gutters", role: "gutter_sealant", label: "Sealant", rule: "per_count", measurement: "eave_segments", qtyEach: 1, productionOnly: true },
];

export const LABOR: LaborLine[] = [
  { key: "labor.roof.install", trade: "roofing", task: "install", label: "Roof install", measurement: "roof_area", per: 100 },
  { key: "labor.roof.tearoff", trade: "roofing", task: "tear_off", label: "Tear-off per layer", measurement: "roof_area", per: 100, times: "tear_off_layers" },
  { key: "labor.siding.install", trade: "siding", task: "install", label: "Siding install", measurement: "siding_area", per: 100 },
  { key: "labor.siding.soffit", trade: "siding", task: "soffit", label: "Soffit install", measurement: "soffit_total" },
  { key: "labor.windows.install", trade: "windows", task: "install", label: "Window install", measurement: "window_count" },
  { key: "labor.gutters.install", trade: "gutters", task: "install", label: "Gutter install", measurement: "eaves" },
  { key: "labor.gutters.downspouts", trade: "gutters", task: "downspouts", label: "Downspout install", measurement: "downspout_length" },
];

export const LABOR_RATES: LaborRate[] = [
  { trade: "roofing", task: "install", unit: "square", rate: 8500 },
  { trade: "roofing", task: "tear_off", unit: "square", rate: 4500 },
  { trade: "siding", task: "install", unit: "square", rate: 25000 },
  { trade: "siding", task: "soffit", unit: "sq ft", rate: 450 },
  { trade: "windows", task: "install", unit: "window", rate: 17500 },
  { trade: "gutters", task: "install", unit: "ft", rate: 400 },
  { trade: "gutters", task: "downspouts", unit: "ft", rate: 500 },
];

export const MARGINS: Record<Trade, number> = { roofing: 0.35, siding: 0.35, windows: 0.3, gutters: 0.4 };

const windows: [number, number, number][] = [
  [26, 46, 9], [23, 64, 5], [34, 43, 5], [21, 39, 4], [27, 40, 4], [26, 54, 3], [47, 43, 2], [29, 64, 1], [37, 20, 1],
];
export const WINDOWS: WindowItem[] = windows.map(([width, height, count]) => ({ width, height, count }));

/** Values read from the sample report, each with the page it came from. */
export const REPORT_VALUES: { key: string; label: string; value: number; unit: string; page: number }[] = [
  { key: "roof_area", label: "Roof area", value: 2318, unit: "sq ft", page: 22 },
  { key: "roof_facets", label: "Roof facets", value: 12, unit: "count", page: 22 },
  { key: "pitch", label: "Predominant pitch (x/12)", value: 5, unit: "/12", page: 22 },
  { key: "ridges", label: "Ridges", value: ft(75, 6), unit: "ft", page: 22 },
  { key: "hips", label: "Hips", value: ft(14, 7), unit: "ft", page: 22 },
  { key: "ridges_hips", label: "Ridges + hips", value: ft(90, 1), unit: "ft", page: 22 },
  { key: "valleys", label: "Valleys", value: 0, unit: "ft", page: 22 },
  { key: "rakes", label: "Rakes", value: ft(110, 5), unit: "ft", page: 22 },
  { key: "eaves", label: "Eaves", value: ft(176, 8), unit: "ft", page: 22 },
  { key: "eave_segments", label: "Eave segments", value: 12, unit: "count", page: 22 },
  { key: "flashing", label: "Flashing", value: ft(5, 10), unit: "ft", page: 22 },
  { key: "step_flashing", label: "Step flashing", value: ft(72, 2), unit: "ft", page: 22 },
  { key: "siding_area", label: "Siding area", value: 2513, unit: "sq ft", page: 2 },
  { key: "other_area", label: "Other material (brick), not sided", value: 126, unit: "sq ft", page: 2 },
  { key: "level_starter", label: "Level starter", value: ft(193, 11), unit: "ft", page: 2 },
  { key: "outside_corners_length", label: "Outside corners", value: ft(145, 6), unit: "ft", page: 2 },
  { key: "inside_corners_length", label: "Inside corners", value: ft(76, 11), unit: "ft", page: 2 },
  { key: "opening_tops", label: "Opening tops", value: ft(88, 3), unit: "ft", page: 2 },
  { key: "opening_sills", label: "Opening sills", value: ft(64, 6), unit: "ft", page: 2 },
  { key: "opening_sides", label: "Opening sides", value: 149, unit: "ft", page: 2 },
  { key: "frieze_level", label: "Level frieze board", value: ft(187, 2), unit: "ft", page: 2 },
  { key: "frieze_sloped", label: "Sloped frieze board", value: ft(91, 10), unit: "ft", page: 2 },
  { key: "soffit_level", label: "Level soffit", value: 457, unit: "sq ft", page: 2 },
  { key: "soffit_sloped", label: "Sloped soffit", value: 92, unit: "sq ft", page: 2 },
  { key: "siding_openings", label: "Siding openings (summary)", value: 30, unit: "count", page: 2 },
];

/** What HOVER never measures. Asked as a site checklist, never guessed. */
export const SITE_CHECKLIST: { key: string; label: string; unit: string }[] = [
  { key: "tear_off_layers", label: "Shingle layers to tear off", unit: "layers" },
  { key: "pipe_boots", label: "Pipe boots on the roof", unit: "count" },
  { key: "downspouts", label: "Downspouts", unit: "count" },
  { key: "eave_height", label: "Average downspout height (eave to ground)", unit: "ft" },
  { key: "gutter_corners", label: "Gutter corners (miters)", unit: "count" },
];

/** The site checklist as answered on the demo visit, used by tests and the demo seed's "visited" job. */
export const SITE_ANSWERS: Record<string, number> = {
  tear_off_layers: 1, pipe_boots: 3, downspouts: 6, eave_height: 18, gutter_corners: 6,
};

export function demoMeasurements(siteAnswers: Record<string, number | null> = SITE_ANSWERS): Measurements {
  const values: Record<string, number | null> = {};
  for (const v of REPORT_VALUES) values[v.key] = v.value;
  for (const c of SITE_CHECKLIST) values[c.key] = siteAnswers[c.key] ?? null;
  return { values, windows: WINDOWS };
}
