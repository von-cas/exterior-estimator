import { NextResponse } from "next/server";
import { outboxAuthorized } from "@/lib/outbox-auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { logEvent } from "@/lib/log";

// n8n calls this on a schedule. It returns up to `limit` pending events and
// marks them claimed; an event not acknowledged within 10 minutes is offered again.
export async function POST(req: Request) {
  if (!outboxAuthorized(req)) {
    await logEvent({ level: "warning", event: "outbox.unauthorized" });
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const limit = Math.min(Math.max(Number(new URL(req.url).searchParams.get("limit") ?? 10), 1), 50);
  const { data, error } = await supabaseAdmin().rpc("claim_outbox", { p_limit: limit });
  if (error) {
    await logEvent({ level: "error", event: "outbox.claim_failed", detail: { error: error.message } });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ events: data });
}
