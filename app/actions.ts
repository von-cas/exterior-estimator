"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { takeoff } from "@/engine";
import { customerView } from "@/engine/takeoff";
import { loadCatalog, loadMeasurements, pricesUsed, run, type Choices } from "@/lib/load";
import { logEvent } from "@/lib/log";
import { requireRole, type Role } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServer } from "@/lib/supabase/server";

export type Result<T = null> = { ok: true; data: T } | { ok: false; error: string };

/** Every action: check the role, run, log any failure, refresh the screens. */
async function act<T>(name: string, roles: Role[], fn: (actor: string) => Promise<T>): Promise<Result<T>> {
  let actor: string | null = null;
  try {
    const s = await requireRole(...roles);
    actor = s.user.id;
    const data = await fn(actor);
    revalidatePath("/", "layout");
    return { ok: true, data };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await logEvent({ level: "error", actor, event: `${name}.failed`, detail: { error: message } });
    return { ok: false, error: message };
  }
}

async function rpc<T = unknown>(fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabaseAdmin().rpc(fn, args);
  if (error) throw new Error(error.message);
  return data as T;
}

export async function signIn(_: unknown, form: FormData): Promise<Result> {
  const sb = await supabaseServer();
  const { error } = await sb.auth.signInWithPassword({ email: String(form.get("email")), password: String(form.get("password")) });
  if (error) {
    await logEvent({ level: "warning", event: "sign_in.failed", detail: { email: String(form.get("email")) } });
    return { ok: false, error: "Wrong email or password." };
  }
  redirect("/");
}

export async function signOut() {
  const sb = await supabaseServer();
  await sb.auth.signOut();
  redirect("/login");
}

const ESTIMATORS: Role[] = ["admin", "estimator"];

export const setMeasurement = async (reportId: string, key: string, value: number | null) =>
  act("measurement.set", ESTIMATORS, (actor) => rpc("set_measurement", { p_actor: actor, p_report: reportId, p_key: key, p_value: value }));

export const clearFlag = async (flagId: string, note: string) =>
  act("flag.clear", ESTIMATORS, (actor) => rpc("clear_flag", { p_actor: actor, p_flag: flagId, p_note: note }));

export const verifyMeasurements = async (reportId: string) =>
  act("measurements.verify", ESTIMATORS, (actor) => rpc("verify_measurements", { p_actor: actor, p_report: reportId }));

export const reopenMeasurements = async (reportId: string) =>
  act("measurements.reopen", ESTIMATORS, (actor) => rpc("reopen_measurements", { p_actor: actor, p_report: reportId }));

export const recordFieldMeasure = async (reportId: string) =>
  act("windows.field_measure", ["admin", "estimator", "production"], (actor) => rpc("record_field_measure", { p_actor: actor, p_report: reportId }));

/** The server recalculates from the database; the browser's numbers are never trusted. */
export const saveEstimate = async (args: { jobId: string; reportId: string; estimateId: string | null; rowVersion: number; choices: Choices }) =>
  act("estimate.save", ESTIMATORS, async (actor) => {
    const sb = await supabaseServer();
    const [catalog, measurements] = await Promise.all([loadCatalog(sb), loadMeasurements(sb, args.reportId)]);
    const result = run(catalog, measurements, args.choices);
    const view = customerView(result);
    return rpc<{ id: string; row_version: number }>("save_estimate", {
      p_actor: actor, p_estimate: args.estimateId, p_job: args.jobId, p_report: args.reportId,
      p_expected_row_version: args.rowVersion, p_trades: args.choices.trades,
      p_inputs: { selections: args.choices.selections, wasteOverrides: args.choices.wasteOverrides },
      p_trade_prices: view.trades, p_customer_total: view.total,
      p_has_blocking: result.issues.some((i) => i.level === "blocking"),
      p_margins: args.choices.margins, p_result: result, p_prices_used: pricesUsed(result), p_total_cost: result.totalCost,
    });
  });

export const approveEstimate = async (estimateId: string, rowVersion: number) =>
  act("estimate.approve", ESTIMATORS, async (actor) => {
    const { data, error } = await supabaseAdmin().from("estimate_costs").select("result").eq("estimate_id", estimateId).single();
    if (error) throw new Error(error.message);
    const groups = takeoff(data.result).map((g) => ({ supplier: g.supplier, cost: g.cost, lines: g.lines }));
    return rpc("approve_estimate", { p_actor: actor, p_estimate: estimateId, p_expected_row_version: rowVersion, p_purchase_orders: groups });
  });

export const approvePurchaseOrder = async (poId: string) =>
  act("purchase_order.approve", ["admin", "estimator", "production"], (actor) => rpc("approve_purchase_order", { p_actor: actor, p_po: poId }));

/**
 * Upload a PDF: store it, read it, check it, and create the job with its flags.
 * Every model call is recorded in ai_runs, including failures.
 */
export async function uploadReport(_: unknown, form: FormData): Promise<Result<{ jobId: string }>> {
  const { createHash } = await import("node:crypto");
  const { pdfPages, looksScanned } = await import("@/reader/pdf");
  const { readReport, ReadError, PROMPT_VERSION } = await import("@/reader/read");
  const { RedactionError } = await import("@/reader/redact");
  const { FIELDS, SITE_FIELDS } = await import("@/reader/fields");

  const res = await act("report.upload", ESTIMATORS, async (actor) => {
    const file = form.get("file");
    const name = String(form.get("name") ?? "").trim();
    if (!(file instanceof File) || file.size === 0) throw new Error("Choose a PDF file.");
    if (!name) throw new Error("Give the job a name.");
    if (file.size > 20 * 1024 * 1024) throw new Error("The file is larger than 20 MB.");
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (new TextDecoder().decode(bytes.slice(0, 5)) !== "%PDF-") throw new Error("That file is not a PDF.");

    const db = supabaseAdmin();
    const sha = createHash("sha256").update(bytes).digest("hex");
    const { data: dup } = await db.from("measurement_reports").select("job_id, jobs(name)").eq("file_sha256", sha).limit(1).maybeSingle();
    if (dup) throw new Error(`This exact report was already uploaded (job "${(dup.jobs as unknown as { name: string }).name}").`);

    const path = `${sha}.pdf`;
    const up = await db.storage.from("reports").upload(path, bytes, { contentType: "application/pdf", upsert: true });
    if (up.error) throw new Error(`Storing the file failed: ${up.error.message}`);

    const pages = await pdfPages(bytes);
    if (looksScanned(pages)) throw new Error("This PDF has no text layer (a scan). Reading scanned reports from page images is designed but not built yet.");

    const runRow = (r: { model: string; status: string; latencyMs?: number; tokensIn?: number | null; tokensOut?: number | null; output?: unknown; error?: string | null }, pagesSent: number[]) => ({
      model: r.model, prompt_version: PROMPT_VERSION, pages: pagesSent, status: r.status, latency_ms: r.latencyMs ?? null,
      tokens_in: r.tokensIn ?? null, tokens_out: r.tokensOut ?? null, output: r.output ?? null, error: r.error ?? null,
    });

    let outcome;
    try {
      outcome = await readReport(pages);
    } catch (e) {
      const pagesSent = e instanceof ReadError ? e.pagesSent : [];
      const status = e instanceof ReadError && e.llm ? "invalid_output" : "error";
      await db.from("ai_runs").insert(runRow({ model: process.env.LLM_MODEL ?? "unknown", status, error: (e as Error).message, latencyMs: e instanceof ReadError ? e.llm?.latencyMs : undefined }, pagesSent));
      if (e instanceof RedactionError) throw new Error(`${e.message} Enter the measurements by hand for this report.`);
      throw new Error(`Reading failed: ${(e as Error).message}. The file is stored; try again in a minute, or use another model.`);
    }

    const label = new Map(FIELDS.map((f) => [f.key, f]));
    const measurements = [
      ...outcome.read.values.map((v) => ({ key: v.key, label: label.get(v.key)!.label, value: v.value, unit: label.get(v.key)!.unit, page: v.page, source_text: v.source_text, source: "report" })),
      ...FIELDS.filter((f) => !outcome.read.values.some((v) => v.key === f.key)).map((f) => ({ key: f.key, label: f.label, value: null, unit: f.unit, page: null, source_text: null, source: "report" })),
      ...SITE_FIELDS.map((s) => ({ key: s.key, label: s.label, value: null, unit: s.unit, page: null, source_text: null, source: "site" })),
    ];
    const flags = [
      ...outcome.flags,
      ...SITE_FIELDS.map((s) => ({ severity: "blocking", code: "missing", message: `${s.label}: the report cannot know this. Record it from the site visit.`, measurement_key: s.key })),
    ];
    const created = await rpc<{ job_id: string; report_id: string }>("create_report", {
      p_actor: actor, p_job_id: null, p_job_name: name, p_source: "pdf", p_file_path: path, p_sha256: sha,
      p_report_date: outcome.reportDate, p_measurements: measurements, p_windows: outcome.read.windows, p_flags: flags, p_status: "needs_review",
    });
    await db.from("ai_runs").insert(outcome.llm.map((l, i) => ({
      ...runRow({ model: l.model, status: "ok", latencyMs: l.latencyMs, tokensIn: l.tokensIn, tokensOut: l.tokensOut,
        output: i === 0 ? { values: outcome.read.values } : { windows: outcome.read.windows, doors: outcome.read.doors },
        error: l.attempts.length ? JSON.stringify(l.attempts) : null }, outcome.pagesSent),
      report_id: created.report_id,
    })));
    return { jobId: created.job_id };
  });
  if (res.ok) redirect(`/jobs/${res.data.jobId}`);
  return res;
}
