"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Result } from "@/app/actions";

export function ActionButton({ action, label, primary, confirm, disabled, title, redirectTo }: {
  action: () => Promise<Result<unknown>>; label: string; primary?: boolean; confirm?: string; disabled?: boolean; title?: string; redirectTo?: string;
}) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  return (
    <span>
      <button className={primary ? "primary" : ""} disabled={disabled || pending} title={title}
        onClick={() => {
          if (confirm && !window.confirm(confirm)) return;
          setError(null);
          start(async () => {
            const r = await action();
            if (!r.ok) setError(r.error);
            else if (redirectTo) router.push(redirectTo);
            else router.refresh();
          });
        }}>
        {pending ? "Working…" : label}
      </button>
      {error && <span className="err" style={{ marginLeft: 8 }}>{error}</span>}
    </span>
  );
}
