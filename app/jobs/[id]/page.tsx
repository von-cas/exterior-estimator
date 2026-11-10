import Link from "next/link";
import { notFound } from "next/navigation";
import { canEstimate, requireUser } from "@/lib/session";
import { when } from "@/lib/format";
import { FlagList } from "@/components/FlagList";
import { MeasurementTable } from "@/components/MeasurementTable";
import { ActionButton } from "@/components/ActionButton";
import { reopenMeasurements, verifyMeasurements } from "@/app/actions";
import { Gates } from "@/components/Gates";
import { SITE_FIELDS } from "@/reader/fields";

export default async function JobPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { sb, profile } = await requireUser();
  const { data: job } = await sb.from("jobs").select("*").eq("id", id).maybeSingle();
  if (!job) notFound();
  const { data: report } = await sb.from("measurement_reports").select("*").eq("job_id", id).order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (!report) return <p>This job has no measurement report.</p>;

  const [{ data: rows }, { data: windows }, { data: flags }, { data: estimates }, { data: pos }] = await Promise.all([
    sb.from("measurements").select("*").eq("report_id", report.id),
    sb.from("measurement_windows").select("*").eq("report_id", report.id).order("width"),
    sb.from("flags").select("*").eq("report_id", report.id).order("created_at"),
    sb.from("estimates").select("id, status, version").eq("job_id", id).order("version", { ascending: false }),
    sb.from("purchase_orders").select("status, estimate_id"),
  ]);
  const editable = canEstimate(profile.role) && report.status !== "verified";
  const siteKeys = new Set<string>(SITE_FIELDS.map((s) => s.key));
  const reportRows = rows!.filter((r) => !siteKeys.has(r.key));
  const siteRows = SITE_FIELDS.map((s) => rows!.find((r) => r.key === s.key)).filter(Boolean);
  const blocking = flags!.filter((f) => f.severity === "blocking" && f.status === "open").length;
  const est = estimates![0];
  const jobPos = (pos ?? []).filter((p) => estimates!.some((e) => e.id === p.estimate_id));

  return (
    <>
      <div className="row spread">
        <div>
          <h1>{job.name}</h1>
          <div className="muted small">Report source: {report.source} · added {when(report.created_at)}{report.report_date ? ` · report dated ${report.report_date}` : ""}</div>
        </div>
        <div className="row">
          <Link className="btn" href={`/jobs/${id}/estimate`}>Estimate</Link>
          <Link className="btn" href={`/jobs/${id}/orders`}>Takeoff and orders</Link>
        </div>
      </div>
      <Gates measurements={report.status === "verified"} estimate={est?.status === "approved"} orders={jobPos.length > 0 && jobPos.every((p) => p.status === "sent")} />

      <div className="panel">
        <div className="row spread">
          <h2>Gate 1: measurements {report.status === "verified" && <span className="chip ok">verified {when(report.verified_at)}</span>}</h2>
          {canEstimate(profile.role) && (report.status === "verified"
            ? <ActionButton label="Reopen" action={reopenMeasurements.bind(null, report.id)} />
            : <ActionButton primary label="Verify measurements" action={verifyMeasurements.bind(null, report.id)}
                disabled={blocking > 0} title={blocking ? `${blocking} blocking flag(s) open` : undefined} />)}
        </div>
        <FlagList flags={flags!} canClear={editable} />
      </div>

      <div className="grid2">
        <div className="panel">
          <h2>Site checklist</h2>
          <p className="muted small">No measurement report knows these. They are asked, never guessed.</p>
          <MeasurementTable reportId={report.id} rows={siteRows as never} editable={editable} showPage={false} />
        </div>
        <div className="panel">
          <h2>Windows ({windows!.reduce((s, w) => s + w.count, 0)})</h2>
          <p className="muted small">{windows!.every((w) => w.field_measured) ? "Field measured." : "Sizes from photos: priced now, ordered after a field measure."}</p>
          <table>
            <thead><tr><th>Width × height (in)</th><th className="num">United inches</th><th className="num">Count</th><th className="num">Page</th></tr></thead>
            <tbody>{windows!.map((w) => (
              <tr key={w.id}><td>{Number(w.width)} × {Number(w.height)}</td><td className="num">{Number(w.width) + Number(w.height)}</td><td className="num">{w.count}</td><td className="num">{w.page ?? "—"}</td></tr>
            ))}</tbody>
          </table>
        </div>
      </div>

      <div className="panel">
        <h2>From the report</h2>
        <p className="muted small">Every value shows the page it came from. A corrected value keeps the report&apos;s original beside it.</p>
        <MeasurementTable reportId={report.id} rows={reportRows} editable={editable} showPage />
      </div>
    </>
  );
}
