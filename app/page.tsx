import Link from "next/link";
import { requireUser, canEstimate } from "@/lib/session";
import { usd, when } from "@/lib/format";
import { UploadReport } from "@/components/UploadReport";

// Reading a report with a free model can take a few minutes.
export const maxDuration = 300;

export default async function Jobs() {
  const { sb, profile } = await requireUser();
  const { data: jobs, error } = await sb
    .from("jobs")
    .select("id, name, created_at, measurement_reports(status, source, created_at), estimates(status, customer_total, version)")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  const latest = jobs!.map((j) => ({
    report: [...j.measurement_reports].sort((a, b) => b.created_at.localeCompare(a.created_at))[0],
    est: [...j.estimates].sort((a, b) => b.version - a.version)[0],
  }));
  const approved = latest.filter((l) => l.est?.status === "approved");
  return (
    <>
      <h1>Jobs</h1>
      <p className="lede">Each job starts from a measurement report. Measurements, the estimate and each purchase order are approved by a person.</p>
      <div className="stats">
        <div className="stat"><div className="stat-k">Jobs</div><div className="stat-v">{jobs!.length}</div></div>
        <div className="stat"><div className="stat-k">Measurements verified</div><div className="stat-v">{latest.filter((l) => l.report?.status === "verified").length}</div></div>
        <div className="stat"><div className="stat-k">Estimates approved</div><div className="stat-v">{approved.length}</div></div>
        <div className="stat dark"><div className="stat-k">Approved value</div><div className="stat-v">{usd(approved.reduce((s, l) => s + Number(l.est.customer_total), 0))}</div></div>
      </div>
      {canEstimate(profile.role) && <UploadReport />}
      <div className="panel scroll">
        <table className="jobs">
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
