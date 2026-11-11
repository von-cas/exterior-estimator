export function Gates({ measurements, estimate, orders }: { measurements: boolean; estimate: boolean; orders: boolean }) {
  const steps: [boolean, string][] = [[measurements, "Measurements approved"], [estimate, "Estimate approved"], [orders, "Purchase orders sent"]];
  const current = steps.findIndex(([done]) => !done);
  return (
    <ol className="gates">
      {steps.map(([done, label], i) => (
        <li key={label} className={`gate ${done ? "done" : i === current ? "current" : ""}`}>
          <span className="gate-n">{done ? "✓" : i + 1}</span>
          <span><span className="gate-k">Gate {i + 1}</span>{label}</span>
        </li>
      ))}
    </ol>
  );
}
