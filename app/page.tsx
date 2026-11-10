import Link from "next/link";
import { requireUser, canEstimate } from "@/lib/session";
import { usd, when } from "@/lib/format";
import { UploadReport } from "@/components/UploadReport";

export default async function Jobs() {
  const { sb, profile } = await requireUser();
  const { data: jobs, error } = await sb
    .from("jobs")
    .select("id, name, created_at, measurement_reports(status, source, created_at), estimates(status, customer_total, version)")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (
    <>
      <h1>Jobs</h1>
      <p className="muted">Each job starts from a measurement report. Measurements, the estimate and each purchase order are approved by a person.</p>
      {canEstimate(profile.role) && <UploadReport />}
      <div className="panel scroll">
        <table>
          <thead><tr><th>Job</th><th>Measurements</th><th>Estimate</th><th className="num">Customer total</th><th>Created</th></tr></thead>
          <tbody>
            {jobs!.map((j) => {
              const report = [...j.measurement_reports].sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
              const est = [...j.estimates].sort((a, b) => b.version - a.version)[0];
              return (
                <tr key={j.id}>
                  <td><Link href={`/jobs/${j.id}`}>{j.name}</Link></td>
                  <td>{report ? <span className={`chip ${report.status === "verified" ? "ok" : report.status === "failed" ? "bad" : "warn"}`}>{report.status.replace("_", " ")}</span> : "—"}</td>
                  <td>{est ? <span className={`chip ${est.status === "approved" ? "ok" : ""}`}>{est.status} v{est.version}</span> : "—"}</td>
                  <td className="num">{est ? usd(est.customer_total) : "—"}</td>
                  <td className="muted">{when(j.created_at)}</td>
                </tr>
              );
            })}
            {!jobs!.length && <tr><td colSpan={5} className="muted">No jobs yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
