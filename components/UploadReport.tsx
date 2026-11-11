"use client";
import { useActionState } from "react";
import { uploadReport } from "@/app/actions";

export function UploadReport() {
  const [state, action, pending] = useActionState(uploadReport, null);
  return (
    <form action={action} className="panel">
      <h2>New job from a HOVER report</h2>
      <div className="row">
        <input name="name" placeholder="Job name" required style={{ minWidth: 220 }} />
        <input name="file" type="file" accept="application/pdf" required />
        <button className="primary" type="submit" disabled={pending}>{pending ? "Reading…" : "Upload and read"}</button>
      </div>
      <p className="muted small">
        {pending
          ? "Reading the report. The model gets the measurement pages with the address removed, never the cover page. This usually takes 10 to 20 seconds."
          : "The model copies numbers with the page each came from. Code then checks every number against its page and the report's own totals."}
      </p>
      {state && !state.ok && <div className="notice bad">{state.error}</div>}
    </form>
  );
}
