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
