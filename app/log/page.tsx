import { requireRole } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { when } from "@/lib/format";

export default async function LogPage() {
  const { sb } = await requireRole("admin");
  const [{ data: events }, { data: runs }, { data: audit }] = await Promise.all([
    sb.from("event_log").select("*").order("at", { ascending: false }).limit(100),
    sb.from("ai_runs").select("id, model, prompt_version, pages, status, latency_ms, tokens_in, tokens_out, error, created_at").order("created_at", { ascending: false }).limit(20),
    sb.from("audit_log").select("id, at, table_name, action, actor, row_id").order("at", { ascending: false }).limit(30),
  ]);
  // The outbox has no client access at all; admin sees its state through the server.
  const { data: outbox } = await supabaseAdmin().from("event_outbox").select("id, event_type, status, attempts, last_error, created_at, done_at").order("id", { ascending: false }).limit(30);
  return (
    <>
      <h1>Log</h1>
      <p className="lede">Every business event, failure, AI run and data change is recorded. n8n alerts on errors.</p>
      <Section title="Events">
        <thead><tr><th>When</th><th>Level</th><th>Event</th><th>Detail</th></tr></thead>
        <tbody>{events!.map((e) => (
          <tr key={e.id}><td className="small">{when(e.at)}</td><td><span className={`chip ${e.level === "error" ? "bad" : e.level === "warning" ? "warn" : ""}`}>{e.level}</span></td>
            <td className="mono small">{e.event}</td><td className="small muted">{JSON.stringify(e.detail)}</td></tr>
        ))}</tbody>
      </Section>
      <Section title="Outbox (collected by n8n)">
        <thead><tr><th>#</th><th>Event</th><th>Status</th><th className="num">Attempts</th><th>Last error</th><th>Created</th><th>Done</th></tr></thead>
        <tbody>{outbox!.map((o) => (
          <tr key={o.id}><td>{o.id}</td><td className="mono small">{o.event_type}</td><td><span className={`chip ${o.status === "done" ? "ok" : o.status === "failed" ? "bad" : "warn"}`}>{o.status}</span></td>
            <td className="num">{o.attempts}</td><td className="small err">{o.last_error}</td><td className="small">{when(o.created_at)}</td><td className="small">{when(o.done_at)}</td></tr>
        ))}</tbody>
      </Section>
      <Section title="AI runs">
        <thead><tr><th>When</th><th>Model</th><th>Status</th><th className="num">Pages</th><th className="num">ms</th><th className="num">Tokens in/out</th><th>Error</th></tr></thead>
        <tbody>{runs!.map((r) => (
          <tr key={r.id}><td className="small">{when(r.created_at)}</td><td className="mono small">{r.model}<div className="muted">{r.prompt_version}</div></td>
            <td><span className={`chip ${r.status === "ok" ? "ok" : "bad"}`}>{r.status}</span></td><td className="num">{r.pages.length}</td>
            <td className="num">{r.latency_ms}</td><td className="num">{r.tokens_in ?? "—"}/{r.tokens_out ?? "—"}</td><td className="small err">{r.error}</td></tr>
        ))}</tbody>
      </Section>
      <Section title="Audit (latest changes)">
        <thead><tr><th>When</th><th>Table</th><th>Action</th><th>Row</th></tr></thead>
        <tbody>{audit!.map((a) => (
          <tr key={a.id}><td className="small">{when(a.at)}</td><td className="mono small">{a.table_name}</td><td>{a.action}</td><td className="mono small muted">{a.row_id?.slice(0, 8)}</td></tr>
        ))}</tbody>
      </Section>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="panel"><h2>{title}</h2><div className="scroll"><table>{children}</table></div></div>;
}
