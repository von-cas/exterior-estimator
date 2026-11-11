"use client";
import { useMemo, useState, useTransition } from "react";
import { calculate, customerView, TRADES, type EstimateResult, type Measurements, type Trade } from "@/engine";
import { buildInputs, type Catalog, type Choices } from "@/lib/load";
import { approveEstimate, saveEstimate } from "@/app/actions";
import { pct, usd, TRADE_LABEL } from "@/lib/format";

interface Meta { id: string; rowVersion: number; status: string; version: number; approvedAt: string | null }

export function EstimateEditor(props: {
  jobId: string; reportId: string; reportVerified: boolean; catalog: Catalog; measurements: Measurements;
  initial: Choices; estimate: Meta | null; storedResult: EstimateResult | null;
}) {
  const { catalog } = props;
  const [choices, setChoices] = useState<Choices>(props.initial);
  const [meta, setMeta] = useState<Meta | null>(props.estimate);
  const [dirty, setDirty] = useState(!props.estimate);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const approved = meta?.status === "approved";

  // Live recalculation in the browser with the same engine the server uses.
  // The server recalculates on save; these numbers are never sent as truth.
  const live = useMemo(() => {
    try { return calculate(buildInputs(catalog, props.measurements, choices)); }
    catch (e) { return e as Error; }
  }, [catalog, props.measurements, choices]);
  const result = approved && props.storedResult ? props.storedResult : live;

  const update = (fn: (c: Choices) => Choices) => { setChoices(fn); setDirty(true); };
  const blocking = result instanceof Error ? 1 : result.issues.filter((i) => i.level === "blocking").length;

  const save = () => start(async () => {
    setError(null);
    const r = await saveEstimate({ jobId: props.jobId, reportId: props.reportId, estimateId: meta?.id ?? null, rowVersion: meta?.rowVersion ?? 0, choices });
    if (!r.ok) return setError(r.error);
    setMeta({ id: r.data.id, rowVersion: r.data.row_version, status: "draft", version: meta?.version ?? 1, approvedAt: null });
    setDirty(false);
  });
  const approve = () => start(async () => {
    if (!meta) return;
    if (!window.confirm("Approve this estimate? Its prices are frozen and draft purchase orders are created.")) return;
    setError(null);
    const r = await approveEstimate(meta.id, meta.rowVersion);
    if (!r.ok) return setError(r.error);
    setMeta({ ...meta, status: "approved", rowVersion: meta.rowVersion + 1 });
  });

  const approveBlocker = !meta ? "Save first" : dirty ? "Save changes first" : !props.reportVerified ? "Verify the measurements first (gate 1)"
    : blocking ? `${blocking} blocking issue(s)` : null;

  return (
    <>
      <div className="row spread">
        <div>
          <h1>Gate 2: estimate {meta && <span className={`chip ${approved ? "ok" : ""}`}>{meta.status} v{meta.version}</span>}</h1>
          <p className="muted small">Change products, waste, labor and margins; every line recalculates. Prices are made up for the demo.</p>
        </div>
        {!(result instanceof Error) && (
          <div className="totalcard">
            <div className="muted small">Cost {usd(result.totalCost)} · margin {result.totalPrice ? pct(1 - result.totalCost / result.totalPrice) : "—"}</div>
            <div className="total">{usd(result.totalPrice)}</div>
          </div>
        )}
      </div>

      {!approved && (
        <div className="panel row">
          <span className="muted">Trades:</span>
          {TRADES.map((t) => (
            <label key={t} className="row toggle" style={{ gap: 6 }}>
              <input type="checkbox" checked={choices.trades.includes(t)}
                onChange={(e) => update((c) => ({ ...c, trades: e.target.checked ? [...c.trades, t] : c.trades.filter((x) => x !== t) }))} />
              {TRADE_LABEL[t]}
            </label>
          ))}
          <span style={{ flex: 1 }} />
          <button onClick={save} disabled={pending || !dirty}>{pending ? "Working…" : dirty ? "Save draft" : "Saved"}</button>
          <button className="primary" onClick={approve} disabled={pending || !!approveBlocker} title={approveBlocker ?? undefined}>Approve estimate</button>
        </div>
      )}
      {approveBlocker && !approved && meta && <p className="muted small">Approve is locked: {approveBlocker}.</p>}
      {error && <div className="notice bad">{error}</div>}
      {approved && <div className="notice ok">Approved. These numbers are the frozen snapshot; later price changes do not touch them. Re-pricing creates a new version.</div>}

      {result instanceof Error ? <div className="notice bad">{result.message}</div> : (
        <>
          {result.issues.length > 0 && (
            <div className="panel">
              <h2>Issues</h2>
              {result.issues.map((i, n) => <div key={n} className={`notice ${i.level === "blocking" ? "bad" : "warn"}`}>{i.message}</div>)}
            </div>
          )}
          {result.trades.map((t) => (
            <TradeCard key={t.trade} trade={t.trade} result={result} catalog={catalog} choices={choices} update={update} readOnly={approved} />
          ))}
          <CustomerPreview result={result} />
        </>
      )}
    </>
  );
}

function TradeCard({ trade, result, catalog, choices, update, readOnly }: {
  trade: Trade; result: EstimateResult; catalog: Catalog; choices: Choices; update: (fn: (c: Choices) => Choices) => void; readOnly: boolean;
}) {
  const t = result.trades.find((x) => x.trade === trade)!;
  const lines = result.materials.filter((m) => m.trade === trade);
  const labor = result.labor.filter((l) => l.trade === trade);
  const templateLine = (key: string) => catalog.template.find((l) => l.key === key.split(":")[0]);
  return (
    <div className="panel">
      <div className="row spread">
        <h2>{TRADE_LABEL[trade]}</h2>
        <div className="row">
          <label className="row" style={{ gap: 4 }}>Margin
            <input type="number" min={0} max={95} step={0.5} disabled={readOnly} value={+(choices.margins[trade] * 100).toFixed(2)}
              onChange={(e) => {
                const v = Number(e.target.value) / 100;
                if (v >= 0 && v < 1) update((c) => ({ ...c, margins: { ...c.margins, [trade]: v } }));
              }} />%
          </label>
          <span className="muted small">= {pct(t.markup)} markup</span>
          <span className="muted small">cost {usd(t.cost)}</span>
          <span className="tradeprice">{usd(t.price)}</span>
        </div>
      </div>
      <div className="scroll">
        <table>
          <thead><tr><th>Line</th><th>Product</th><th className="num">Waste</th><th>Workings</th><th className="num">Qty</th><th className="num">Unit cost</th><th className="num">Cost</th></tr></thead>
          <tbody>
            {lines.map((m) => {
              const tl = templateLine(m.key);
              const options = catalog.products.filter((p) => p.role === (tl?.rule === "per_item" ? "" : tl?.role));
              const hasWaste = tl && (tl.rule === "area" || tl.rule === "linear");
              const waste = choices.wasteOverrides[m.key] ?? tl?.waste ?? 0;
              return (
                <tr key={m.key}>
                  <td>{m.label}{m.productionOnly && <div className="muted small">production only, not shown to the customer</div>}{m.lockedForPurchase && <div className="muted small">ordered after field measure</div>}</td>
                  <td>
                    {options.length > 1 && !readOnly ? (
                      <select value={m.productId} onChange={(e) => update((c) => ({ ...c, selections: { ...c.selections, [tl!.role]: e.target.value } }))}>
                        {options.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    ) : <span>{m.productName}</span>}
                    <div className="muted small">{m.sku} · {m.supplier}</div>
                  </td>
                  <td className="num">
                    {hasWaste ? (
                      <><input type="number" min={0} max={50} step={1} disabled={readOnly} value={+(waste * 100).toFixed(1)}
                        onChange={(e) => {
                          const v = Number(e.target.value) / 100;
                          if (v >= 0 && v < 1) update((c) => ({ ...c, wasteOverrides: { ...c.wasteOverrides, [m.key]: v } }));
                        }} />%</>
                    ) : "—"}
                  </td>
                  <td className="muted small">{m.workings}</td>
                  <td className="num">{m.quantity} {m.unit}</td>
                  <td className="num">{usd(m.unitCost)}</td>
                  <td className="num">{usd(m.cost)}</td>
                </tr>
              );
            })}
            {labor.map((l) => (
              <tr key={l.key}>
                <td>{l.label}<div className="muted small">labor</div></td><td /><td className="num">—</td>
                <td className="muted small">{l.workings}</td>
                <td className="num">{l.quantity} {l.unit}</td><td className="num">{usd(l.rate)}</td><td className="num">{usd(l.cost)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr><td colSpan={6} className="num muted">Materials {usd(t.materialCost)} + labor {usd(t.laborCost)} = cost</td><td className="num"><b>{usd(t.cost)}</b></td></tr>
            <tr><td colSpan={6} className="num muted">Price = cost ÷ (1 − {pct(t.margin)})</td><td className="num"><b>{usd(t.price)}</b></td></tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

function CustomerPreview({ result }: { result: EstimateResult }) {
  const v = customerView(result);
  return (
    <details className="panel">
      <summary><b>What the customer sees</b> <span className="muted small">no cost, margin or production-only lines</span></summary>
      <table style={{ marginTop: 8 }}>
        <tbody>
          {v.trades.map((t) => <tr key={t.trade}><td><b>{TRADE_LABEL[t.trade]}</b><div className="muted small">{[...new Set(t.items)].join(", ")}</div></td><td className="num">{usd(t.price)}</td></tr>)}
          <tr><td className="total">Total</td><td className="num total">{usd(v.total)}</td></tr>
        </tbody>
      </table>
    </details>
  );
}
