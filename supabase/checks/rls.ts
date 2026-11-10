import { createClient } from "@supabase/supabase-js";
// Signs in as each demo role and counts what row-level security lets it read.
// Expected: sales reads no prices or labor rates; nobody reads the outbox; no client can call an action function.
for (const role of ["sales", "production", "estimator", "admin"]) {
  const c = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, { auth: { persistSession: false } });
  const s = await c.auth.signInWithPassword({ email: `${role}@exterior-estimator.test`, password: process.env.DEMO_PASSWORD! });
  if (s.error) { console.log(role, s.error.message); continue; }
  const out: Record<string, unknown> = {};
  for (const t of ["products", "prices", "labor_rates", "measurements", "flags", "audit_log", "event_outbox"]) {
    const r = await c.from(t).select("*", { count: "exact", head: true });
    out[t] = r.error ? `ERR ${r.error.message.slice(0, 40)}` : r.count;
  }
  const rpc = await c.rpc("verify_measurements", { p_actor: s.data.user!.id, p_report: "00000000-0000-0000-0000-000000000000" });
  out.rpc = rpc.error ? "denied" : "ALLOWED";
  console.log(role, JSON.stringify(out));
}
