// The fixed set of fields the reader asks for. Anything else in a report is ignored.
export interface Field {
  key: string;
  label: string;
  unit: "sq ft" | "ft" | "count" | "/12";
  /** The engine needs it; empty means a blocking flag. */
  required: boolean;
  range: [number, number];
  hint: string;
}

export const FIELDS: Field[] = [
  { key: "roof_area", label: "Roof area", unit: "sq ft", required: true, range: [200, 30000], hint: "Total roof area (all facets) from the roof summary" },
  { key: "roof_facets", label: "Roof facets", unit: "count", required: false, range: [1, 200], hint: "Number of roof facets" },
  { key: "pitch", label: "Predominant pitch (x/12)", unit: "/12", required: false, range: [0, 24], hint: "Predominant pitch, rise per 12" },
  { key: "ridges", label: "Ridges", unit: "ft", required: true, range: [0, 2000], hint: "Total ridge length" },
  { key: "hips", label: "Hips", unit: "ft", required: true, range: [0, 2000], hint: "Total hip length" },
  { key: "ridges_hips", label: "Ridges + hips", unit: "ft", required: true, range: [0, 4000], hint: "Stated total of ridges plus hips" },
  { key: "valleys", label: "Valleys", unit: "ft", required: true, range: [0, 2000], hint: "Total valley length; 0 if the report says none" },
  { key: "rakes", label: "Rakes", unit: "ft", required: true, range: [0, 3000], hint: "Total rake length" },
  { key: "eaves", label: "Eaves", unit: "ft", required: true, range: [0, 3000], hint: "Total eave length (gutter line)" },
  { key: "eave_segments", label: "Eave segments", unit: "count", required: true, range: [1, 200], hint: "Number of eave segments" },
  { key: "flashing", label: "Flashing", unit: "ft", required: false, range: [0, 1000], hint: "Flashing length" },
  { key: "step_flashing", label: "Step flashing", unit: "ft", required: true, range: [0, 1000], hint: "Step flashing length" },
  { key: "siding_area", label: "Siding area", unit: "sq ft", required: true, range: [100, 30000], hint: "Siding facade area: the Facades row of the Siding column on the summary page. Not the Total row, which adds openings" },
  { key: "other_area", label: "Other material (brick), not sided", unit: "sq ft", required: false, range: [0, 30000], hint: "The Facades row of the Other column (brick, stone) on the summary page. Not the Total row" },
  { key: "level_starter", label: "Level starter", unit: "ft", required: true, range: [0, 3000], hint: "Level starter length" },
  { key: "outside_corners_length", label: "Outside corners", unit: "ft", required: true, range: [0, 3000], hint: "Total length of outside corners" },
  { key: "inside_corners_length", label: "Inside corners", unit: "ft", required: true, range: [0, 3000], hint: "Total length of inside corners" },
  { key: "opening_tops", label: "Opening tops", unit: "ft", required: true, range: [0, 3000], hint: "Total length of opening tops" },
  { key: "opening_sills", label: "Opening sills", unit: "ft", required: true, range: [0, 3000], hint: "Total length of opening sills" },
  { key: "opening_sides", label: "Opening sides", unit: "ft", required: true, range: [0, 3000], hint: "Total length of opening sides" },
  { key: "frieze_level", label: "Level frieze board", unit: "ft", required: true, range: [0, 3000], hint: "Level frieze board length on the summary page" },
  { key: "frieze_level_table", label: "Level frieze board (siding table)", unit: "ft", required: false, range: [0, 3000], hint: "Level frieze board length in the siding waste table, if the report gives a second figure" },
  { key: "frieze_sloped", label: "Sloped frieze board", unit: "ft", required: false, range: [0, 3000], hint: "Sloped frieze board length" },
  { key: "soffit_level", label: "Level soffit", unit: "sq ft", required: true, range: [0, 10000], hint: "Level soffit area" },
  { key: "soffit_sloped", label: "Sloped soffit", unit: "sq ft", required: true, range: [0, 10000], hint: "Sloped soffit area" },
  { key: "siding_openings", label: "Siding openings (summary)", unit: "count", required: false, range: [0, 500], hint: "Number of siding openings stated on the summary" },
  { key: "window_count_total", label: "Windows (stated total)", unit: "count", required: false, range: [0, 500], hint: "Stated total number of windows" },
  { key: "window_united_inches_total", label: "Window united inches (stated total)", unit: "count", required: false, range: [0, 100000], hint: "Stated total united inches of all windows" },
];

/** Asked on site because no measurement report knows them. */
export const SITE_FIELDS = [
  { key: "tear_off_layers", label: "Shingle layers to tear off", unit: "layers" },
  { key: "pipe_boots", label: "Pipe boots on the roof", unit: "count" },
  { key: "downspouts", label: "Downspouts", unit: "count" },
  { key: "eave_height", label: "Average downspout height (eave to ground)", unit: "ft" },
  { key: "gutter_corners", label: "Gutter corners (miters)", unit: "count" },
] as const;

/** Values kept for checking only; the engine never uses them. */
export const CHECK_ONLY = new Set(["frieze_level_table", "window_count_total", "window_united_inches_total"]);
