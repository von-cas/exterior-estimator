import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/** The signed-in user's client. Everything it reads passes row-level security. */
export async function supabaseServer() {
  const store = await cookies();
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          list.forEach(({ name, value, options }) => store.set(name, value, options));
        } catch {
          // Called from a server component; the proxy refreshes the session instead.
        }
      },
    },
  });
}
