interface StatsCardProps {
  label: string;
  value: string | number;
  sub?: string;
}

export default function StatsCard({ label, value, sub }: StatsCardProps) {
  return (
    <div className="bg-surface-raised border border-border rounded-lg p-5">
      <p className="text-sm text-text-muted mb-1">{label}</p>
      <p className="text-2xl font-semibold text-text-primary tabular-nums">
        {typeof value === "number" ? value.toLocaleString() : value}
      </p>
      {sub && <p className="text-xs text-text-secondary mt-1">{sub}</p>}
    </div>
  );
}
