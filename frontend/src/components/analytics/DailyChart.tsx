"use client";

import { useState } from "react";

import { localDay } from "@/lib/dates";

type Day = { date: string; meetings: number; minutes: number };

const H = 150, PAD_L = 28, PAD_B = 22, PAD_T = 8, W = 640;

/** Single-series bar chart: minutes of conversation per (local) day across the selected range. */
export function DailyChart({ from, to, meetings }: { from: string; to: string; meetings: { date: string; minutes: number }[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const [asTable, setAsTable] = useState(false);

  // Fill every day in the range so gaps read as zero, not as missing axis ticks.
  // Which day a meeting falls on depends on the viewer's timezone, so bucket here, not on the server.
  const byDate = new Map<string, Day>();
  for (const m of meetings) {
    const key = localDay(new Date(m.date));
    const day = byDate.get(key) ?? { date: key, meetings: 0, minutes: 0 };
    day.meetings += 1;
    day.minutes = Math.round((day.minutes + m.minutes) * 10) / 10;
    byDate.set(key, day);
  }
  const days: Day[] = [];
  const start = new Date(localDay(new Date(from)) + "T00:00:00");
  const end = new Date(localDay(new Date(to)) + "T00:00:00");
  for (let d = new Date(start); d <= end && days.length < 92; d.setDate(d.getDate() + 1)) {
    days.push(byDate.get(localDay(d)) ?? { date: localDay(d), meetings: 0, minutes: 0 });
  }
  const max = Math.max(1, ...days.map((d) => d.minutes));
  const niceMax = Math.ceil(max / 5) * 5;
  const slot = (W - PAD_L) / Math.max(1, days.length);
  const barW = Math.min(28, slot * 0.6);
  const y = (v: number) => PAD_T + (H - PAD_T - PAD_B) * (1 - v / niceMax);
  const labelEvery = Math.ceil(days.length / 8);
  const label = (iso: string) => new Date(iso + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });

  return (
    <div className="rounded-xl border border-line bg-panel p-4">
      <div className="mb-2 flex items-center">
        <h3 className="flex-1 text-[13px] text-muted">Time in conversations per day (minutes)</h3>
        <button onClick={() => setAsTable(!asTable)} className="text-xs text-muted hover:text-text">
          {asTable ? "Show chart" : "Show table"}
        </button>
      </div>
      {asTable ? (
        <table className="w-full text-left text-xs">
          <thead className="text-faint"><tr><th className="py-1 font-normal">Date</th><th className="font-normal">Meetings</th><th className="font-normal">Minutes</th></tr></thead>
          <tbody>
            {days.filter((d) => d.meetings).map((d) => (
              <tr key={d.date} className="border-t border-line"><td className="py-1">{label(d.date)}</td><td>{d.meetings}</td><td>{d.minutes}</td></tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="relative">
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img"
            aria-label={`Minutes of conversation per day, peak ${max} minutes`}>
            {[0, 0.5, 1].map((f) => (
              <g key={f}>
                <line x1={PAD_L} x2={W} y1={y(niceMax * f)} y2={y(niceMax * f)} stroke="var(--line)" strokeWidth={1} />
                <text x={PAD_L - 6} y={y(niceMax * f) + 3} textAnchor="end" fontSize={10} fill="var(--faint)">{niceMax * f}</text>
              </g>
            ))}
            {days.map((d, i) => {
              const x = PAD_L + i * slot + (slot - barW) / 2;
              const top = y(d.minutes), h = H - PAD_B - top;
              const r = Math.min(4, h / 2, barW / 2);
              return (
                <g key={d.date} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
                  {/* Hit target spans the whole day slot, bigger than the bar itself. */}
                  <rect x={PAD_L + i * slot} y={PAD_T} width={slot} height={H - PAD_T - PAD_B} fill="transparent" />
                  {d.minutes > 0 && (
                    <path d={`M${x},${H - PAD_B} v${-(h - r)} q0,${-r} ${r},${-r} h${barW - 2 * r} q${r},0 ${r},${r} v${h - r} z`}
                      fill="var(--primary)" opacity={hover === null || hover === i ? 1 : 0.45} />
                  )}
                  {i % labelEvery === 0 && (
                    <text x={PAD_L + i * slot + slot / 2} y={H - 6} textAnchor="middle" fontSize={10} fill="var(--faint)">{label(d.date)}</text>
                  )}
                </g>
              );
            })}
          </svg>
          {hover !== null && (
            <div className="pointer-events-none absolute top-0 -translate-x-1/2 rounded-md border border-line bg-card px-2.5 py-1.5 text-xs shadow-lg"
              style={{ left: `${((PAD_L + hover * slot + slot / 2) / W) * 100}%` }}>
              <p className="font-medium">{label(days[hover].date)}</p>
              <p className="text-muted">{days[hover].meetings} meeting{days[hover].meetings === 1 ? "" : "s"} · {days[hover].minutes} min</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
