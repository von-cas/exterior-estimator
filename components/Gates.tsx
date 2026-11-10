export function Gates({ measurements, estimate, orders }: { measurements: boolean; estimate: boolean; orders: boolean }) {
  const g = (done: boolean, label: string) => <span className={`gate ${done ? "done" : ""}`}>{done ? "✓ " : ""}{label}</span>;
  return <div className="gates">{g(measurements, "1 Measurements approved")}{g(estimate, "2 Estimate approved")}{g(orders, "3 Purchase orders sent")}</div>;
}
