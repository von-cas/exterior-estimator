import { supabaseAdmin } from "./supabase/admin";

/** Writes to event_log. Logging must never break the action it describes. */
export async function logEvent(e: {
  level?: "info" | "warning" | "error"; actor?: string | null; event: string;
  entity?: string; entity_id?: string | null; detail?: Record<string, unknown>;
}) {
  try {
    await supabaseAdmin().from("event_log").insert({ level: e.level ?? "info", ...e, detail: e.detail ?? {} });
  } catch (err) {
    console.error("event_log write failed", err, e);
  }
}
