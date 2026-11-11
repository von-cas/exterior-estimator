import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser, canEstimate } from "@/lib/session";
import { loadCatalog, loadMeasurements, type Choices } from "@/lib/load";
import { TRADES, type EstimateResult } from "@/engine";
import { EstimateEditor } from "@/components/EstimateEditor";
import { usd, TRADE_LABEL, when } from "@/lib/format";

export default async function EstimatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { sb, profile } = await requireUser();
  const { data: job } = await sb.from("jobs").select("*").eq("id", id).maybeSingle();
  if (!job) notFound();
  const { data: report } = await sb.from("measurement_reports").select("*").eq("job_id", id).order("created_at", { ascending: false }).limit(1).single();
  const { data: est } = await sb.from("estimates").select("*").eq("job_id", id).order("version", { ascending: false }).limit(1).maybeSingle();

  const back = <p className="back"><Link href={`/jobs/${id}`}>← {job.name}</Link></p>;

  if (!canEstimate(profile.role)) {
    // Sales and production see selling prices only. Row-level security would hide costs anyway.
    return (
      <>
        {back}
        <h1>Customer estimate</h1>
        {!est ? <p className="muted">No estimate yet.</p> : (
          <div className="panel">
            <p><span className={`chip ${est.status === "approved" ? "ok" : ""}`}>{est.status} v{est.version}</span> <span className="muted small">updated {when(est.updated_at)}</span></p>
            <table>
              <tbody>
                {(est.trade_prices as { trade: string; price: number; items: string[] }[]).map((t) => (
                  <tr key={t.trade}><td><b>{TRADE_LABEL[t.trade]}</b><div className="muted small">{[...new Set(t.items)].join(", ")}</div></td><td className="num">{usd(t.price)}</td></tr>
                ))}
                <tr><td className="total">Total</td><td className="num total">{usd(est.customer_total)}</td></tr>
              </tbody>
            </table>
          </div>
        )}
      </>
    );
  }

  const [catalog, measurements, costs] = await Promise.all([
    loadCatalog(sb),
    loadMeasurements(sb, report!.id),
    est ? sb.from("estimate_costs").select("*").eq("estimate_id", est.id).maybeSingle().then((r) => r.data) : Promise.resolve(null),
  ]);
  const choices: Choices = est
    ? { trades: est.trades, selections: est.inputs.selections ?? {}, wasteOverrides: est.inputs.wasteOverrides ?? {}, margins: { ...catalog.margins, ...(costs?.margins ?? {}) } }
    : { trades: [...TRADES], selections: {}, wasteOverrides: {}, margins: catalog.margins };

  return (
    <>
      {back}
      <EstimateEditor
        jobId={id} reportId={report!.id} reportVerified={report!.status === "verified"}
        catalog={catalog} measurements={measurements} initial={choices}
        estimate={est ? { id: est.id, rowVersion: est.row_version, status: est.status, version: est.version, approvedAt: est.approved_at } : null}
        storedResult={est?.status === "approved" ? (costs?.result as EstimateResult) : null}
      />
    </>
  );
}
