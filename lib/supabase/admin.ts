import { createClient } from "@supabase/supabase-js";

/**
 * Server only. Bypasses row-level security, so it is used for two things:
 * calling the action functions (which check the actor's role themselves) and
 * writing logs. Never import this from a client component.
 */
export function supabaseAdmin() {
  if (typeof window !== "undefined") throw new Error("supabaseAdmin is server only");
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
