import { NextResponse } from "next/server";
import { outboxAuthorized } from "@/lib/outbox-auth";
import { supabaseAdmin } from "@/lib/supabase/admin";

// n8n reports each event's outcome. Acknowledging twice is harmless.
// Returns the event's new status: done, pending (will be retried) or failed (gave up after 5 attempts).
export async function POST(req: Request) {
  if (!outboxAuthorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => null);
  if (!body || !Number.isInteger(body.id) || typeof body.ok !== "boolean") {
    return NextResponse.json({ error: "send { id: number, ok: boolean, error?: string }" }, { status: 400 });
  }
  const { data, error } = await supabaseAdmin().rpc("ack_outbox", { p_id: body.id, p_ok: body.ok, p_error: body.error ? String(body.error).slice(0, 1000) : null });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ status: data });
}
