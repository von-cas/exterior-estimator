// Seeds the demo: four users, the made-up catalog, templates and one job from
// the sample report. Safe to run again. Needs SUPABASE_SECRET_KEY and DEMO_PASSWORD.
import { createClient } from "@supabase/supabase-js";
import { check } from "../../reader/check";
import { SITE_FIELDS } from "../../reader/fields";
import { LABOR, LABOR_RATES, MARGINS, PRODUCTS, REPORT_VALUES, TEMPLATE, WINDOWS } from "./demo-data";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.SUPABASE_SECRET_KEY!;
const password = process.env.DEMO_PASSWORD;
if (!url || !key || !password) throw new Error("Set NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY and DEMO_PASSWORD");
const db = createClient(url, key, { auth: { persistSession: false } });

export const DEMO_USERS = [
  { role: "admin", name: "Avery Admin" },
  { role: "estimator", name: "Elliot Estimator" },
  { role: "sales", name: "Sam Sales" },
  { role: "production", name: "Pat Production" },
] as const;
export const DEMO_JOB = "Demo job: sample HOVER report";
const email = (role: string) => `${role}@exterior-estimator.test`;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ok = <R extends { data: any; error: { message: string } | null }>(r: R, what: string): NonNullable<R["data"]> => {
  if (r.error || r.data === null) throw new Error(`${what}: ${r.error?.message ?? "no data"}`);
  return r.data;
};

/** For writes that return no rows. */
async function ok2(q: PromiseLike<{ error: { message: string } | null }>, what: string) {
  const { error } = await q;
  if (error) throw new Error(`${what}: ${error.message}`);
}

async function users() {
  const existing = ok(await db.auth.admin.listUsers({ perPage: 1000 }), "list users").users;
  const ids: Record<string, string> = {};
  for (const u of DEMO_USERS) {
    const found = existing.find((x) => x.email === email(u.role));
    const id = found
      ? ok(await db.auth.admin.updateUserById(found.id, { password }), "update user").user!.id
      : ok(await db.auth.admin.createUser({ email: email(u.role), password, email_confirm: true }), "create user").user!.id;
    await ok2(db.from("profiles").upsert({ id, full_name: u.name, role: u.role }), "profile");
    ids[u.role] = id;
  }
  return ids;
}

async function catalog() {
  for (const p of PRODUCTS) {
    const row = ok(await db.from("products").upsert(
      { sku: p.sku, name: p.name, trade: p.trade, role: p.role, unit: p.unit, coverage: p.coverage },
      { onConflict: "sku" }).select("id").single(), "product");
    const current = ok(await db.from("prices").select("id").eq("product_id", row.id).eq("supplier", p.supplier).is("valid_to", null), "price");
    if (!current.length) await ok2(db.from("prices").insert({ product_id: row.id, supplier: p.supplier, unit_cost: p.unitCost, valid_from: "2026-01-01" }), "insert price");
  }
  for (const r of LABOR_RATES) {
    const current = ok(await db.from("labor_rates").select("id").eq("trade", r.trade).eq("task", r.task).is("valid_to", null), "labor");
    if (!current.length) await ok2(db.from("labor_rates").insert({ ...r, valid_from: "2026-01-01" }), "insert labor");
  }
  for (const trade of ["roofing", "siding", "windows", "gutters"] as const) {
    const t = ok(await db.from("templates").upsert({ trade, name: `Standard ${trade}`, default_margin: MARGINS[trade] }, { onConflict: "trade,name" }).select("id").single(), "template");
    const lines = TEMPLATE.filter((l) => l.trade === trade).map((l, i) => ({
      template_id: t.id, key: l.key, role: l.role, label: l.label, rule: l.rule, measurement: l.measurement ?? null,
      waste: l.waste ?? null, spacing: l.spacing ?? null, qty_each: l.qtyEach ?? null, quantity: l.quantity ?? null,
      bands: l.bands ?? null, production_only: l.productionOnly ?? false, sort: i,
    }));
    await ok2(db.from("template_lines").upsert(lines, { onConflict: "key" }), "template lines");
    const labor = LABOR.filter((l) => l.trade === trade).map((l, i) => ({
      template_id: t.id, key: l.key, task: l.task, label: l.label, measurement: l.measurement, per: l.per ?? null, times: l.times ?? null, sort: i,
    }));
    await ok2(db.from("template_labor").upsert(labor, { onConflict: "key" }), "template labor");
  }
}

const ft = (f: number, i = 0) => Math.round((f + i / 12) * 10000) / 10000;

async function demoJob(estimator: string) {
  if (process.argv.includes("--reset")) {
    await ok2(db.from("jobs").delete().eq("name", DEMO_JOB), "reset demo job");
    console.log("demo job removed");
  }
  const exists = ok(await db.from("jobs").select("id").eq("name", DEMO_JOB), "job");
  if (exists.length) return console.log("demo job already there");
  const extra = [
    { key: "frieze_level_table", label: "Level frieze board (siding table)", value: ft(179, 1), unit: "ft", page: 18 },
    { key: "window_count_total", label: "Windows (stated total)", value: 34, unit: "count", page: 19 },
    { key: "window_united_inches_total", label: "Window united inches (stated total)", value: 2546, unit: "count", page: 19 },
  ];
  const values = [...REPORT_VALUES, ...extra];
  const windows = WINDOWS.map((w) => ({ ...w, page: 20 }));
  const doors = [
    { width: 36, height: 82, count: 2, page: 21 }, { width: 32, height: 80, count: 1, page: 21 }, { width: 192, height: 84, count: 1, page: 21 },
  ];
  const flags = check({ values: values.map((v) => ({ key: v.key, value: v.value, page: v.page, source_text: null })), windows, doors, report_date: null });
  const site = SITE_FIELDS.map((s) => ({ key: s.key, label: s.label, value: null, unit: s.unit, page: null, source: "site" }));
  for (const s of SITE_FIELDS) flags.push({ severity: "blocking", code: "missing", message: `${s.label}: the report cannot know this. Record it from the site visit.`, measurement_key: s.key });

  await ok2(db.rpc("create_report", {
    p_actor: estimator, p_job_id: null, p_job_name: DEMO_JOB, p_source: "seed", p_file_path: null, p_sha256: null,
    p_report_date: null, p_measurements: [...values.map((v) => ({ ...v, source: "report" })), ...site],
    p_windows: windows, p_flags: flags, p_status: "needs_review",
  }), "create report");
  console.log(`demo job created with ${flags.length} flags`);
}

const ids = await users();
await catalog();
await demoJob(ids.estimator);
console.log("seeded:", DEMO_USERS.map((u) => email(u.role)).join(", "));
