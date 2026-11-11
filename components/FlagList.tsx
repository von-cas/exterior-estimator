"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { clearFlag } from "@/app/actions";

interface Flag { id: string; severity: string; code: string; message: string; status: string; note: string | null; measurement_key: string | null }

export function FlagList({ flags, canClear }: { flags: Flag[]; canClear: boolean }) {
  const order = { blocking: 0, warning: 1, info: 2 } as Record<string, number>;
  const sorted = [...flags].sort((a, b) => (a.status === b.status ? order[a.severity] - order[b.severity] : a.status === "open" ? -1 : 1));
  const open = flags.filter((f) => f.status === "open");
  return (
    <>
      <p className="muted small">
        {open.filter((f) => f.severity === "blocking").length} blocking, {open.filter((f) => f.severity === "warning").length} warnings open.
        Blocking flags stop approval. Clearing a flag needs a reason, and is logged.
      </p>
      <table className="flags">
        <tbody>{sorted.map((f) => <FlagRow key={f.id} f={f} canClear={canClear} />)}</tbody>
      </table>
    </>
  );
}

function FlagRow({ f, canClear }: { f: Flag; canClear: boolean }) {
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const cleared = f.status === "cleared";
  // A missing value is cleared by entering it, not by a note.
  const clearable = canClear && !cleared && f.code !== "missing";
  return (
    <tr style={{ opacity: cleared ? 0.55 : 1 }}>
      <td style={{ width: 90 }}><span className={`chip ${cleared ? "ok" : f.severity}`}>{cleared ? "cleared" : f.severity}</span></td>
      <td>
        {f.message}
        {cleared && f.note && <div className="muted small">Note: {f.note}</div>}
        {error && <div className="err">{error}</div>}
      </td>
      <td style={{ width: 340 }}>
        {clearable && (
          <div className="row">
            <input placeholder="Why is this OK?" value={note} onChange={(e) => setNote(e.target.value)} style={{ flex: 1 }} />
            <button disabled={pending || !note.trim()} onClick={() => start(async () => {
              const r = await clearFlag(f.id, note);
              if (!r.ok) setError(r.error);
              else router.refresh();
            })}>Clear</button>
          </div>
        )}
      </td>
    </tr>
  );
}
