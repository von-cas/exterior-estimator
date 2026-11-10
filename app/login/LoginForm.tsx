"use client";
import { useActionState } from "react";
import { signIn } from "../actions";

export function LoginForm() {
  const [state, action, pending] = useActionState(signIn, null);
  return (
    <form action={action}>
      <label htmlFor="email">Email</label>
      <input id="email" name="email" type="email" required autoComplete="username" />
      <label htmlFor="password">Password</label>
      <input id="password" name="password" type="password" required autoComplete="current-password" />
      <p><button className="primary" type="submit" disabled={pending}>{pending ? "Signing in…" : "Sign in"}</button></p>
      {state && !state.ok && <p className="err">{state.error}</p>}
    </form>
  );
}
