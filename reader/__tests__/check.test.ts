import { describe, expect, it } from "vitest";
import { appearsOn, check, numbersIn, type ReadResult } from "../check";
import { REPORT_VALUES, WINDOWS } from "../../supabase/seed/demo-data";

const ft = (f: number, i = 0) => f + i / 12;
const sample = (): ReadResult => ({
  values: [
    ...REPORT_VALUES.map((v) => ({ key: v.key, value: v.value, page: v.page, source_text: null })),
    { key: "frieze_level_table", value: ft(179, 1), page: 18, source_text: null },
    { key: "window_count_total", value: 34, page: 19, source_text: null },
    { key: "window_united_inches_total", value: 2546, page: 19, source_text: null },
  ],
  windows: WINDOWS.map((w) => ({ ...w, page: 20 })),
  doors: [
    { width: 36, height: 82, count: 2, page: 21 },
    { width: 32, height: 80, count: 1, page: 21 },
    { width: 192, height: 84, count: 1, page: 21 },
  ],
  report_date: null,
});

describe("checker on the sample report", () => {
  const flags = check(sample());
  const codes = flags.map((f) => `${f.severity}:${f.code}`);

  it("passes the totals the report gets right", () => {
    expect(codes).not.toContain("blocking:total_mismatch");
    expect(flags.filter((f) => f.severity === "blocking")).toEqual([]);
  });
  it("raises the known problems as warnings for a person", () => {
    expect(codes).toContain("warning:two_values"); // frieze 187' 2" vs 179' 1"
    const openings = flags.find((f) => f.code === "count_mismatch")!;
    expect(openings.message).toContain("34 windows and 3 doors (37"); // garage door left out
    expect(codes).toContain("info:photo_sizes");
  });
});

describe("checker catches bad reads", () => {
  it("a missing required value is blocking, never filled in", () => {
    const r = sample();
    r.values.find((v) => v.key === "eaves")!.value = null;
    expect(check(r).some((f) => f.code === "missing" && f.measurement_key === "eaves" && f.severity === "blocking")).toBe(true);
  });
  it("parts that do not add up to their total are blocking", () => {
    const r = sample();
    r.values.find((v) => v.key === "hips")!.value = 41;
    expect(check(r).some((f) => f.code === "total_mismatch" && f.measurement_key === "ridges_hips")).toBe(true);
  });
  it("an impossible value is blocking", () => {
    const r = sample();
    r.values.find((v) => v.key === "roof_area")!.value = 23180000;
    expect(check(r).some((f) => f.code === "out_of_range")).toBe(true);
  });
  it("a number that is not on the cited page is blocking", () => {
    const r: ReadResult = { values: [{ key: "roof_area", value: 2318, page: 1, source_text: null }], windows: [], doors: [], report_date: "2026-01-01" };
    const flags = check(r, ["Roof area 2,381 sq ft"], new Date("2026-06-01"));
    expect(flags.some((f) => f.code === "not_on_page")).toBe(true);
    expect(check(r, ["Roof area 2,318 sq ft"], new Date("2026-06-01")).some((f) => f.code === "not_on_page")).toBe(false);
  });
  it("an old report gets a warning", () => {
    const r = sample();
    r.report_date = "2020-05-01";
    expect(check(r, undefined, new Date("2026-11-11")).some((f) => f.code === "old_report")).toBe(true);
  });
});

describe("reading numbers off a page", () => {
  it("understands feet and inches as HOVER prints them", () => {
    expect(appearsOn(75.5, `Ridges 75' 6" Hips 14' 7"`)).toBe(true);
    expect(appearsOn(176 + 8 / 12, "Eaves: 176ft 8in")).toBe(true);
    expect(appearsOn(2318, "Total Area 2,318 ft²")).toBe(true);
    expect(appearsOn(2319, "Total Area 2,318 ft²")).toBe(false);
  });
  it("finds plain numbers too", () => {
    expect(numbersIn("34 windows, 2,546 UI")).toEqual(expect.arrayContaining([34, 2546]));
  });
});
