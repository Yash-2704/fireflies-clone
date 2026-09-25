"use client";

import { Pause, Play, RotateCcw, RotateCw } from "lucide-react";

import { Player } from "@/components/meeting/usePlayer";
import { fmtTime } from "@/lib/format";

const RATES = [1, 1.25, 1.5, 2, 0.75];

export function PlayerBar({ player }: { player: Player }) {
  const { time, duration, playing, rate } = player;
  return (
    <div className="shrink-0 border-t border-line bg-panel">
      <input type="range" min={0} max={duration || 1} step={0.1} value={time} aria-label="Seek"
        onChange={(e) => player.seek(Number(e.target.value))}
        className="block h-1 w-full cursor-pointer accent-[var(--primary)]" />
      <div className="relative flex h-14 items-center px-4">
        <span className="font-mono text-[13px] tabular-nums text-muted">
          <span className="text-text">{fmtTime(time)}</span> / {fmtTime(duration)}
        </span>
        <div className="absolute left-1/2 flex -translate-x-1/2 items-center gap-4 max-sm:static max-sm:ml-auto max-sm:translate-x-0 max-sm:gap-3">
          <button onClick={() => player.setRate(RATES[(RATES.indexOf(rate) + 1) % RATES.length])}
            aria-label="Playback speed" className="w-10 text-[13px] text-muted hover:text-text">{rate}×</button>
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
      </div>
    </div>
  );
}
