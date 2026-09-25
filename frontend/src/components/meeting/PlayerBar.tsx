"use client";

import { Pause, Play, RotateCcw, RotateCw } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { BOOKMARK_KINDS } from "@/components/meeting/useAnnotations";
import { Player } from "@/components/meeting/usePlayer";
import { Bookmark, BookmarkKind } from "@/lib/api";
import { fmtTime } from "@/lib/format";

const RATES = [0.75, 1, 1.25, 1.5, 1.75, 2, 2.5, 3];

export function PlayerBar({ player, bookmarks, onBookmark }: {
  player: Player;
  bookmarks: Bookmark[];
  onBookmark: (kind: BookmarkKind, at: number) => void;
}) {
  const { time, duration, playing, rate } = player;
  const [speedOpen, setSpeedOpen] = useState(false);
  const speedRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!speedOpen) return;
    const close = (e: MouseEvent) => !speedRef.current?.contains(e.target as Node) && setSpeedOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [speedOpen]);

  return (
    <div className="shrink-0 border-t border-line bg-panel">
      <div className="relative">
        <input type="range" min={0} max={duration || 1} step={0.1} value={time} aria-label="Seek"
          onChange={(e) => player.seek(Number(e.target.value))}
          className="block h-1 w-full cursor-pointer accent-[var(--primary)]" />
        {/* Bookmark ticks on the timeline */}
        {duration > 0 && bookmarks.map((b) => (
          <span key={b.id} title={`${BOOKMARK_KINDS[b.kind].label} · ${fmtTime(b.at_sec)}`}
            className="pointer-events-none absolute -top-1 h-2 w-0.5 rounded"
            style={{ left: `${(b.at_sec / duration) * 100}%`, background: BOOKMARK_KINDS[b.kind].color }} />
        ))}
      </div>
      <div className="relative flex h-14 items-center px-4">
        <span className="font-mono text-[13px] tabular-nums text-muted">
          <span className="text-text">{fmtTime(time)}</span> / {fmtTime(duration)}
        </span>
        <div className="absolute left-1/2 flex -translate-x-1/2 items-center gap-4 max-sm:static max-sm:ml-auto max-sm:translate-x-0 max-sm:gap-3">
          <div ref={speedRef} className="relative">
            <button onClick={() => setSpeedOpen(!speedOpen)} aria-label="Playback speed"
              className="w-10 text-[13px] text-muted hover:text-text">{rate}×</button>
            {speedOpen && (
              <div className="absolute bottom-9 left-1/2 z-30 w-20 -translate-x-1/2 rounded-lg border border-line bg-panel p-1 shadow-xl">
                {RATES.map((r) => (
                  <button key={r} onClick={() => { player.setRate(r); setSpeedOpen(false); }}
                    className={`block w-full rounded px-2 py-1 text-left text-xs hover:bg-hover ${r === rate ? "text-primary" : ""}`}>
                    {r}×
                  </button>
                ))}
              </div>
            )}
          </div>
          <button onClick={() => player.seek(time - 15)} aria-label="Back 15 seconds" className="text-muted hover:text-text">
            <RotateCcw size={18} />
          </button>
          <button onClick={player.toggle} aria-label={playing ? "Pause" : "Play"}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-white hover:bg-primary-hover">
            {playing ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" className="ml-0.5" />}
          </button>
          <button onClick={() => player.seek(time + 15)} aria-label="Forward 15 seconds" className="text-muted hover:text-text">
            <RotateCw size={18} />
          </button>
        </div>
        {/* One-click bookmarks at the current moment, like Fireflies' ☆ ☑ 👍 👎 */}
        <div className="ml-auto flex items-center gap-1 max-sm:hidden">
          {(Object.keys(BOOKMARK_KINDS) as BookmarkKind[]).map((k) => {
            const { icon: Icon, label, color } = BOOKMARK_KINDS[k];
            const count = bookmarks.filter((b) => b.kind === k).length;
            return (
              <button key={k} onClick={() => onBookmark(k, time)} title={`Bookmark as ${label} at ${fmtTime(time)}`}
                aria-label={`Bookmark as ${label}`}
                className="flex items-center gap-1 rounded-md px-1.5 py-1 text-xs text-muted hover:bg-hover hover:text-text">
                <Icon size={16} style={count ? { color } : undefined} />{count > 0 && count}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
