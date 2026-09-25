import { Info } from "lucide-react";

/** "▲ 12%" vs the previous period, or "--" when there's nothing to compare against. */
export function delta(current: number, previous: number | null | undefined) {
  if (previous == null || previous === 0) return "--";
  const pct = Math.round(((current - previous) / previous) * 100);
  return pct === 0 ? "No change" : `${pct > 0 ? "▲" : "▼"} ${Math.abs(pct)}%`;
}

export function StatCard({ title, value, info, current, previous, children }: {
  title: string;
  value?: React.ReactNode;
  info: string;
  current?: number;
  previous?: number | null;
  children?: React.ReactNode;
}) {
  return (
    <div className="group relative rounded-xl border border-line bg-panel p-4">
      <div className="flex items-start gap-2">
        <h3 className="flex-1 text-[13px] text-muted">{title}</h3>
        <span title={info} aria-label={info} className="text-faint opacity-60 group-hover:opacity-100"><Info size={13} /></span>
      </div>
      {children ?? (
        <>
          <p className="mt-3 text-2xl font-semibold tabular-nums">{value}</p>
          {current !== undefined && (
            <p className="mt-1 text-xs text-faint">
              <span className="text-muted">{delta(current, previous)}</span> vs previous period
            </p>
          )}
        </>
      )}
    </div>
  );
}
