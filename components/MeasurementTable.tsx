"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setMeasurement } from "@/app/actions";
import { feetInches, num } from "@/lib/format";

interface Row { key: string; label: string; value: number | null; unit: string; page: number | null; original_value: number | null; source_text: string | null }

export function MeasurementTable({ reportId, rows, editable, showPage }: { reportId: string; rows: Row[]; editable: boolean; showPage: boolean }) {
  return (
    <div className="scroll">
      <table>
        <thead><tr><th>Measure</th><th className="num">Value</th><th>Unit</th>{showPage && <th className="num">Page</th>}<th></th></tr></thead>
        <tbody>{rows.map((r) => <MRow key={r.key} r={r} reportId={reportId} editable={editable} showPage={showPage} />)}</tbody>
      </table>
    </div>
  );
}

function MRow({ r, reportId, editable, showPage }: { r: Row; reportId: string; editable: boolean; showPage: boolean }) {
  const value = r.value === null ? null : Number(r.value);
  const original = r.original_value === null ? null : Number(r.original_value);
  const [draft, setDraft] = useState(value === null ? "" : String(value));
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const changed = draft !== (value === null ? "" : String(value));
  const corrected = original !== null && value !== original;
  return (
    <tr>
      <td>{r.label}{r.source_text && <div className="muted small">“{r.source_text}”</div>}</td>
      <td className="num">
        {editable ? (
          <input type="number" step="any" value={draft} onChange={(e) => setDraft(e.target.value)} aria-label={r.label}
            style={value === null ? { borderColor: "var(--bad)" } : undefined} />
        ) : (
          <span>{num(value)}</span>
        )}
        {r.unit === "ft" && value !== null && <div className="muted small">{feetInches(value)}</div>}
        {corrected && <div className="muted small">report said {num(original)}</div>}
      </td>
      <td className="muted">{r.unit}</td>
      {showPage && <td className="num">{r.page ?? "—"}</td>}
      <td>
        {editable && changed && (
          <button disabled={pending} onClick={() => start(async () => {
            const v = draft.trim() === "" ? null : Number(draft);
            if (v !== null && (Number.isNaN(v) || v < 0)) return setError("Enter a number of zero or more.");
            const res = await setMeasurement(reportId, r.key, v);
            setError(res.ok ? null : res.error);
            if (res.ok) router.refresh();
          })}>Save</button>
        )}
        {error && <div className="err">{error}</div>}
      </td>
    </tr>
  );
}
