"use client";

import { ChevronDown, ChevronUp, Search, Undo2, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { Player } from "@/components/meeting/usePlayer";
import { Avatar } from "@/components/ui/Avatar";
import { countMatches, Highlight } from "@/components/ui/Highlight";
import { MeetingDetail } from "@/lib/api";
import { fmtTime } from "@/lib/format";

export type TranscriptFilter = { label: string; segmentIds: Set<number> } | null;

export function TranscriptPanel({ meeting, player, filter, onClearFilter, onRenameSpeaker }: {
  meeting: MeetingDetail;
  player: Player;
  filter: TranscriptFilter;
  onClearFilter: () => void;
  onRenameSpeaker: (speakerId: number, name: string) => Promise<void>;
}) {
  const [query, setQuery] = useState("");
  const [matchIndex, setMatchIndex] = useState(0);
  const [following, setFollowing] = useState(true);
  const [renaming, setRenaming] = useState<number | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const rows = useRef(new Map<number, HTMLDivElement>());

  const speakers = useMemo(() => new Map(meeting.speakers.map((s) => [s.id, s])), [meeting.speakers]);
  const segments = filter ? meeting.segments.filter((s) => filter.segmentIds.has(s.id)) : meeting.segments;

  // Active line = last segment that has started. Segments are sorted by start time.
  const activeId = useMemo(() => {
    let id: number | null = null;
    for (const s of meeting.segments) {
      if (s.start_sec <= player.time) id = s.id;
      else break;
    }
    return id;
  }, [meeting.segments, player.time]);

  // Flatten matches so ↑/↓ can step through them in order: [segmentId, nth match in segment].
  const matches = useMemo(
    () => segments.flatMap((s) => Array.from({ length: countMatches(s.text, query) }, (_, n) => [s.id, n] as const)),
    [segments, query],
  );
  const current = matches[Math.min(matchIndex, matches.length - 1)];

  function scrollTo(el: HTMLElement | undefined) {
    const box = scroller.current;
    if (!box || !el) return;
    const top = el.getBoundingClientRect().top - box.getBoundingClientRect().top + box.scrollTop;
    box.scrollTo({ top: top - box.clientHeight / 3, behavior: "smooth" });
  }

  useEffect(() => {
    if (current) scrollTo(rows.current.get(current[0])?.querySelector("mark.current") as HTMLElement);
  }, [current]);
  useEffect(() => {
    if (following && activeId != null && !query) scrollTo(rows.current.get(activeId));
  }, [activeId, following, query]);

  const step = (d: number) => matches.length && setMatchIndex((i) => (i + d + matches.length) % matches.length);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-2 px-4 py-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-2.5 top-2.5 text-faint" />
          <input value={query} onChange={(e) => { setQuery(e.target.value); setMatchIndex(0); }} placeholder="Find in transcript"
            onKeyDown={(e) => e.key === "Enter" && step(e.shiftKey ? -1 : 1)} className="input pl-8 pr-24" />
          {query && (
            <div className="absolute right-1.5 top-1.5 flex items-center gap-0.5 text-xs text-muted">
              <span className="px-1 tabular-nums">{matches.length ? `${Math.min(matchIndex, matches.length - 1) + 1} of ${matches.length}` : "0 results"}</span>
              <button onClick={() => step(-1)} aria-label="Previous match" className="rounded p-0.5 hover:bg-hover"><ChevronUp size={14} /></button>
              <button onClick={() => step(1)} aria-label="Next match" className="rounded p-0.5 hover:bg-hover"><ChevronDown size={14} /></button>
            </div>
          )}
        </div>
      </div>
      {filter && (
        <div className="mx-4 mb-2 flex items-center justify-between rounded-md bg-primary-soft px-3 py-1.5 text-xs">
          <span>Showing <b>{filter.label}</b> · {segments.length} lines</span>
          <button onClick={onClearFilter} aria-label="Clear filter" className="text-muted hover:text-text"><X size={13} /></button>
        </div>
      )}

      <div ref={scroller} onWheel={() => player.playing && setFollowing(false)} onTouchMove={() => setFollowing(false)}
        className="relative min-h-0 flex-1 overflow-y-auto px-4 pb-6">
        {segments.map((s) => {
          const sp = speakers.get(s.speaker_id)!;
          const active = s.id === activeId;
          return (
            <div key={s.id} ref={(el) => { if (el) rows.current.set(s.id, el); else rows.current.delete(s.id); }}
              className={`group mb-1 rounded-lg px-2 py-2 transition-colors ${active ? "bg-primary-soft" : "hover:bg-card"}`}>
              <div className="mb-1 flex items-center gap-2 text-[13px]">
                <Avatar name={sp.name} size={20} square />
                {renaming === sp.id ? (
                  <form onSubmit={async (e) => {
                    e.preventDefault();
                    const name = new FormData(e.currentTarget).get("name") as string;
                    if (name.trim() && name.trim() !== sp.name) await onRenameSpeaker(sp.id, name.trim());
                    setRenaming(null);
                  }}>
                    <input name="name" autoFocus defaultValue={sp.name} onBlur={() => setRenaming(null)}
                      className="input h-6 w-40 py-0" aria-label="Speaker name" />
                  </form>
                ) : (
                  <button onClick={() => setRenaming(sp.id)} title="Rename speaker" className="flex items-center gap-0.5 font-medium hover:underline">
                    {sp.name} <ChevronDown size={12} className="text-faint opacity-0 group-hover:opacity-100" />
                  </button>
                )}
                <span className="text-faint">·</span>
                <button onClick={() => player.seek(s.start_sec)} className="text-xs text-link hover:underline">
                  {fmtTime(s.start_sec)}
                </button>
              </div>
              <p onClick={() => player.seek(s.start_sec)}
                className={`cursor-pointer pl-7 text-[13.5px] leading-relaxed ${active ? "text-text" : "text-muted"}`}>
                <Highlight text={s.text} query={query} currentIndex={current?.[0] === s.id ? current[1] : undefined} />
              </p>
            </div>
          );
        })}
        {segments.length === 0 && <p className="py-10 text-center text-[13px] text-muted">No transcript lines.</p>}
      </div>

      {!following && player.playing && (
        <button onClick={() => { setFollowing(true); scrollTo(rows.current.get(activeId ?? -1)); }}
          className="absolute bottom-20 right-8 z-10 flex items-center gap-1.5 rounded-full border border-line bg-card px-3 py-1.5 text-xs shadow-lg hover:bg-hover">
          <Undo2 size={13} /> Sync with audio
        </button>
      )}
    </div>
  );
}
