import { FIELDS } from "./fields";

export interface ReadValue {
  key: string;
  value: number | null;
  page: number | null;
  source_text: string | null;
}
export interface ReadSize { width: number; height: number; count: number; page: number | null }
export interface ReadResult {
  values: ReadValue[];
  windows: ReadSize[];
  doors: ReadSize[];
  report_date: string | null;
}
export interface Flag {
  severity: "blocking" | "warning" | "info";
  code: string;
  message: string;
  measurement_key: string | null;
}

/** Doors and openings over this size are left out of HOVER's opening totals. */
const BIG_OPENING_SQ_FT = 33;

/**
 * Code checks what the model read. pages (text per page, 1-based) is optional:
 * without it the "number appears on the cited page" check is skipped.
 */
export function check(read: ReadResult, pages?: string[], today = new Date()): Flag[] {
  const flags: Flag[] = [];
  const v = new Map(read.values.map((x) => [x.key, x]));
  const num = (k: string) => v.get(k)?.value ?? null;
  const add = (severity: Flag["severity"], code: string, message: string, key: string | null = null) =>
    flags.push({ severity, code, message, measurement_key: key });

  for (const f of FIELDS) {
    const x = v.get(f.key);
    if (!x || x.value === null) {
      if (f.required) add("blocking", "missing", `${f.label} is not in the report. Enter it from the site visit or another source.`, f.key);
      continue;
    }
    const [lo, hi] = f.range;
    if (x.value < lo || x.value > hi) {
      add("blocking", "out_of_range", `${f.label} = ${fmt(x.value)} ${f.unit} is outside the sane range ${lo} to ${hi}.`, f.key);
    }
    if (pages) {
      const text = x.page ? pages[x.page - 1] : undefined;
      if (!text) add("blocking", "no_page", `${f.label} cites page ${x.page ?? "none"}, which the report does not have.`, f.key);
      else if (!appearsOn(x.value, text)) add("blocking", "not_on_page", `${f.label} = ${fmt(x.value)} does not appear on page ${x.page}. Check it against the report.`, f.key);
    }
  }

  // Totals must agree with their parts.
  const ridges = num("ridges"), hips = num("hips"), rh = num("ridges_hips");
  if (ridges !== null && hips !== null && rh !== null && Math.abs(ridges + hips - rh) > 0.2) {
    add("blocking", "total_mismatch", `Ridges ${fmt(ridges)} + hips ${fmt(hips)} = ${fmt(ridges + hips)} ft, but the report states ${fmt(rh)} ft.`, "ridges_hips");
  }

  const windowCount = read.windows.reduce((s, w) => s + w.count, 0);
  const statedCount = num("window_count_total");
  if (statedCount !== null && read.windows.length && statedCount !== windowCount) {
    add("blocking", "total_mismatch", `The window list adds up to ${windowCount} windows; the report states ${statedCount}.`, "window_count_total");
  }
  const ui = read.windows.reduce((s, w) => s + (w.width + w.height) * w.count, 0);
  const statedUi = num("window_united_inches_total");
  if (statedUi !== null && read.windows.length && Math.abs(statedUi - ui) > 1) {
    add("blocking", "total_mismatch", `The window list adds up to ${fmt(ui)} united inches; the report states ${fmt(statedUi)}.`, "window_united_inches_total");
  }
  for (const w of [...read.windows, ...read.doors]) {
    if (!(w.width > 0 && w.height > 0 && w.count > 0)) add("blocking", "bad_size", `An opening has an impossible size: ${w.width} × ${w.height} in × ${w.count}.`);
  }

  // Two figures for one thing: a person decides, the system does not pick.
  const fl = num("frieze_level"), flt = num("frieze_level_table");
  if (fl !== null && flt !== null && Math.abs(fl - flt) > 1) {
    add("warning", "two_values", `Level frieze board is ${fmt(fl)} ft on the summary and ${fmt(flt)} ft in the siding table. Confirm which applies.`, "frieze_level");
  }

  const openings = num("siding_openings");
  if (openings !== null && (read.windows.length || read.doors.length)) {
    const smallDoors = read.doors.filter((d) => (d.width * d.height) / 144 <= BIG_OPENING_SQ_FT).reduce((s, d) => s + d.count, 0);
    const listed = windowCount + smallDoors;
    if (listed !== openings) {
      add("warning", "count_mismatch",
        `The summary states ${openings} siding openings; the openings pages list ${windowCount} windows and ${smallDoors} doors (${listed}, leaving out openings over ${BIG_OPENING_SQ_FT} sq ft). Mulled windows may count as one opening. Confirm on site.`,
        "siding_openings");
    }
  }

  if (read.windows.length) {
    add("info", "photo_sizes", "Window sizes come from photos: good enough to price, not to order. Window lines stay locked for purchasing until a field measure is recorded.");
  }

  if (!read.report_date) {
    add("info", "no_report_date", "The report date was not recorded. Confirm the house has not changed since it was measured.");
  } else {
    const ageDays = (today.getTime() - new Date(read.report_date).getTime()) / 86_400_000;
    if (ageDays > 365) add("warning", "old_report", `The report is ${Math.floor(ageDays / 365)} year(s) old. Confirm the house has not changed.`);
  }
  return flags;
}

/** Does the value appear on the page, written as a plain number or as feet and inches? */
export function appearsOn(value: number, pageText: string): boolean {
  return numbersIn(pageText).some((n) => Math.abs(n - value) < 0.05);
}

export function numbersIn(text: string): number[] {
  const out: number[] = [];
  const t = text.replace(/[’′]/g, "'").replace(/[”″]/g, '"');
  const ftIn = /(\d[\d,]*(?:\.\d+)?)\s*(?:'|ft\.?)\s*(\d{1,2}(?:\.\d+)?)\s*(?:"|in\.?|'')/gi;
  for (const m of t.matchAll(ftIn)) out.push(parse(m[1]) + parse(m[2]) / 12);
  for (const m of t.matchAll(/\d[\d,]*(?:\.\d+)?/g)) out.push(parse(m[0]));
  return out;
}

const parse = (s: string) => Number(s.replace(/,/g, ""));
const fmt = (x: number) => x.toLocaleString("en-US", { maximumFractionDigits: 2 });
