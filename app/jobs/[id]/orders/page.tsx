import Link from "next/link";
import { notFound } from "next/navigation";
import { canOrder, requireUser } from "@/lib/session";
import { ActionButton } from "@/components/ActionButton";
import { approvePurchaseOrder, recordFieldMeasure } from "@/app/actions";
import { usd, when } from "@/lib/format";
import type { MaterialLine } from "@/engine";

export default async function OrdersPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { sb, profile } = await requireUser();
  const { data: job } = await sb.from("jobs").select("*").eq("id", id).maybeSingle();
  if (!job) notFound();
  const back = <p className="back"><Link href={`/jobs/${id}`}>← {job.name}</Link></p>;
  if (!canOrder(profile.role)) return <>{back}<p>Purchase orders are visible to admin, estimators and production.</p></>;

  const { data: est } = await sb.from("estimates").select("*").eq("job_id", id).eq("status", "approved").order("version", { ascending: false }).limit(1).maybeSingle();
  if (!est) return <>{back}<h1>Gate 3: purchase orders</h1><p className="muted">Approve the estimate first. Approval runs the same calculation in production mode and creates one draft order per supplier.</p></>;

  const [{ data: pos }, { data: windows }] = await Promise.all([
    sb.from("purchase_orders").select("*").eq("estimate_id", est.id).order("supplier"),
    sb.from("measurement_windows").select("field_measured").eq("report_id", est.report_id),
  ]);
  const measured = windows!.length > 0 && windows!.every((w) => w.field_measured);

  return (
    <>
      {back}
      <h1>Gate 3: production takeoff and purchase orders</h1>
      <p className="lede">From approved estimate v{est.version}: the same lines that were priced, grouped by supplier. Each order carries a unique key, so a retry can never order twice. Approved orders are sent by email through n8n.</p>
      {!measured && (
        <div className="notice warn row spread">
          <span>Window sizes come from photos. Window orders stay locked until a field measure is recorded.</span>
          <ActionButton label="Record field measure" action={recordFieldMeasure.bind(null, est.report_id)} confirm="Confirm the window sizes were measured on site?" />
        </div>
      )}
      {pos!.map((po) => {
        const lines = po.lines as MaterialLine[];
        const locked = lines.some((l) => l.lockedForPurchase) && !measured;
        return (
          <div className="panel" key={po.id}>
            <div className="row spread">
              <div>
                <h2>{po.supplier} <span className={`chip ${po.status === "sent" ? "ok" : po.status === "failed" ? "bad" : po.status === "approved" ? "info" : ""}`}>{po.status === "approved" ? "approved, sending" : po.status}</span></h2>
                <div className="muted small">Key {po.idempotency_key.slice(-12)} · {po.sent_at ? `sent ${when(po.sent_at)}` : po.approved_at ? `approved ${when(po.approved_at)}` : `created ${when(po.created_at)}`}</div>
                {po.last_error && <div className="err">Last error: {po.last_error}</div>}
              </div>
              {po.status === "draft" && (
                <ActionButton primary label="Approve and send" action={approvePurchaseOrder.bind(null, po.id)} disabled={locked}
                  title={locked ? "Record a field measure first" : undefined} confirm={`Send this order to ${po.supplier}?`} />
              )}
            </div>
            <div className="scroll">
              <table>
                <thead><tr><th>SKU</th><th>Item</th><th className="num">Qty</th><th className="num">Unit cost</th><th className="num">Cost</th></tr></thead>
                <tbody>
                  {lines.map((l, i) => (
                    <tr key={i}><td className="mono">{l.sku}</td><td>{l.productName}{l.lockedForPurchase && !measured && <span className="chip warn" style={{ marginLeft: 6 }}>field measure</span>}</td>
                      <td className="num">{l.quantity} {l.unit}</td><td className="num">{usd(l.unitCost)}</td><td className="num">{usd(l.cost)}</td></tr>
                  ))}
                </tbody>
                <tfoot><tr><td colSpan={4} className="num"><b>Total</b></td><td className="num"><b>{usd(po.total_cost)}</b></td></tr></tfoot>
              </table>
            </div>
          </div>
        );
      })}
    </>
  );
}
