import { redirect } from "next/navigation";
import { supabaseServer } from "./supabase/server";

export type Role = "admin" | "estimator" | "sales" | "production";
export interface Profile { id: string; full_name: string; role: Role }

export async function currentUser() {
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;
  const { data: profile } = await sb.from("profiles").select("*").eq("id", user.id).single<Profile>();
  if (!profile) return null;
  return { sb, user, profile };
}

export async function requireUser() {
  const s = await currentUser();
  if (!s) redirect("/login");
  return s;
}

export async function requireRole(...roles: Role[]) {
  const s = await requireUser();
  if (!roles.includes(s.profile.role)) throw new Error(`Not allowed: needs ${roles.join(" or ")}`);
  return s;
}

export const canEstimate = (r: Role) => r === "admin" || r === "estimator";
export const canOrder = (r: Role) => r === "admin" || r === "estimator" || r === "production";
