"use client";

type SummaryCardsProps = {
  completed: number;
  pending: number;
  total: number;
  percent: number;
};

export function ChecklistSummaryCards({ completed, pending, total, percent }: SummaryCardsProps) {
  const cards = [
    { label: "Completed", value: completed, color: "var(--success)" },
    { label: "Pending", value: pending, color: "var(--warning)" },
    { label: "Total Items", value: total, color: "var(--accent)" },
    { label: "Completion", value: `${percent}%`, color: percent >= 100 ? "var(--success)" : "var(--accent-strong)" },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {cards.map((card) => (
        <div
          key={card.label}
          className="rounded-2xl border p-4 transition-shadow hover:shadow-md"
          style={{
            background: "var(--surface)",
            borderColor: "var(--border)",
            boxShadow: "var(--shadow-card)",
          }}
        >
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--text-faint)]">
            {card.label}
          </p>
          <p className="mt-2 text-2xl font-bold" style={{ color: card.color }}>
            {card.value}
          </p>
        </div>
      ))}
    </div>
  );
}
