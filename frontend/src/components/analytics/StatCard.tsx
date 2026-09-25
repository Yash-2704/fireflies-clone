"use client";

import { Info } from "lucide-react";
import { useId, useState } from "react";

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
        <InfoTip text={info} />
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

/** ⓘ with a tooltip on mouse hover, keyboard focus, or tap (touch screens have no hover). */
export function InfoTip({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <span className="relative" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button type="button" aria-label="What is this?" aria-describedby={open ? id : undefined} aria-expanded={open}
        onFocus={() => setOpen(true)} onBlur={() => setOpen(false)} onClick={() => setOpen((o) => !o)}
        className={`rounded ${open ? "text-text" : "text-faint"} hover:text-text`}>
        <Info size={14} />
      </button>
      {open && (
        <span id={id} role="tooltip"
          className="absolute right-0 top-6 z-30 w-60 rounded-lg border border-line bg-card px-3 py-2 text-xs leading-relaxed text-text shadow-xl">
          {text}
        </span>
      )}
    </span>
  );
}
