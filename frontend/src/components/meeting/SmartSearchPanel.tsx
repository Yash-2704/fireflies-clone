"use client";

import { Hash, Plus } from "lucide-react";
import { useEffect, useState } from "react";

import { TopicsModal } from "@/components/analytics/TopicsModal";
import { api, MeetingDetail, Segment, Topic } from "@/lib/api";
import { Avatar } from "@/components/ui/Avatar";
import { TranscriptFilter } from "@/components/meeting/TranscriptPanel";
import { fmtTime } from "@/lib/format";

// Lightweight "AI filters": derived from the transcript text itself, so counts are always real.
const FILTERS: { label: string; color: string; match: (s: Segment, taskStarts: Set<number>) => boolean }[] = [
  { label: "Questions", color: "#d4854a", match: (s) => s.text.includes("?") },
  { label: "Tasks", color: "#c75d8f", match: (s, t) => t.has(s.start_sec) },
  { label: "Metrics", color: "#4a8fd4", match: (s) => /\d|percent|thousand|million|\$/i.test(s.text) },
  {
    label: "Dates & Times", color: "#4f9d7e",
    match: (s) => /\b(monday|tuesday|wednesday|thursday|friday|today|tomorrow|next (week|month)|this week|quarter|q[1-4])\b/i.test(s.text),
  },
];

export function SmartSearchPanel({ meeting, filter, onFilter }: {
  meeting: MeetingDetail;
  filter: TranscriptFilter;
  onFilter: (f: TranscriptFilter) => void;
}) {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [managing, setManaging] = useState(false);
  const loadTopics = () => { api.topics().then(setTopics).catch(() => {}); };
  useEffect(loadTopics, []);
  // Same whole-word, case-insensitive matching as the backend's Topic Insights.
  const mentions = (text: string, kw: string) =>
    (text.match(new RegExp(`(?<!\\w)${kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?!\\w)`, "gi")) ?? []).length;

  const taskStarts = new Set(meeting.action_items.flatMap((a) => (a.start_sec == null ? [] : [a.start_sec])));

  const pick = (label: string, segs: Segment[]) =>
    onFilter(filter?.label === label ? null : { label, segmentIds: new Set(segs.map((s) => s.id)) });

  return (
    <div className="space-y-6 p-4">
      <section>
        <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-faint">AI Filters</h3>
        <div className="grid grid-cols-2 gap-2">
          {FILTERS.map((f) => {
            const segs = meeting.segments.filter((s) => f.match(s, taskStarts));
            const on = filter?.label === f.label;
            return (
              <button key={f.label} disabled={!segs.length} onClick={() => pick(f.label, segs)}
                className={`flex items-center gap-2 rounded-md border px-2.5 py-2 text-left text-[13px] disabled:opacity-40 ${on ? "border-primary bg-primary-soft" : "border-line bg-card hover:bg-hover"}`}>
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: f.color }} />
                <span className="flex-1 truncate">{f.label}</span>
                <span className="text-xs text-muted">{segs.length}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section>
        <h3 className="mb-2 flex items-center text-[11px] font-semibold uppercase tracking-wider text-faint">
          <span className="flex-1">Topic Trackers</span>
          <button onClick={() => setManaging(true)} aria-label="Manage topic trackers" className="rounded p-0.5 hover:bg-hover hover:text-text"><Plus size={13} /></button>
        </h3>
        <div className="space-y-1.5">
          {topics.map((t) => {
            const segs = meeting.segments.filter((s) => t.keywords.some((k) => mentions(s.text, k)));
            const count = meeting.segments.reduce((n, s) => n + t.keywords.reduce((m, k) => m + mentions(s.text, k), 0), 0);
            const label = `Topic: ${t.name}`;
            return (
              <button key={t.id} disabled={!count} onClick={() => pick(label, segs)} title={t.keywords.join(", ")}
                className={`flex w-full items-center gap-2 rounded-md border px-2.5 py-2 text-left text-[13px] disabled:opacity-40 ${filter?.label === label ? "border-primary bg-primary-soft" : "border-line bg-card hover:bg-hover"}`}>
                <Hash size={12} className="text-primary" /><span className="flex-1 truncate">{t.name}</span>
                <span className="text-xs text-muted">{count}</span>
              </button>
            );
          })}
          {!topics.length && <p className="text-xs text-muted">No topic trackers yet — add keywords to track.</p>}
        </div>
      </section>

      <section>
        <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-faint">Speaker Talktime</h3>
        <div className="mb-1 flex px-2 text-[11px] text-faint"><span className="flex-1">Speakers</span><span className="w-12 text-right">WPM</span><span className="w-20 text-right">Talktime</span></div>
        <div className="space-y-1.5">
          {meeting.speakers.map((sp) => {
            const label = `${sp.name}'s lines`;
            const on = filter?.label === label;
            return (
              <button key={sp.id} title={`${fmtTime(sp.talk_sec)} spoken · words per minute ${sp.wpm}`}
                onClick={() => pick(label, meeting.segments.filter((s) => s.speaker_id === sp.id))}
                className={`flex w-full items-center rounded-md border px-2 py-2 text-[13px] ${on ? "border-primary bg-primary-soft" : "border-line bg-card hover:bg-hover"}`}>
                <span className="flex min-w-0 flex-1 items-center gap-2"><Avatar name={sp.name} size={20} square /><span className="truncate">{sp.name}</span></span>
                <span className="w-12 text-right text-xs text-muted">{sp.wpm}</span>
                <span className="flex w-20 items-center justify-end gap-1.5 text-xs">
                  <svg width="16" height="16" viewBox="0 0 36 36" aria-hidden>
                    <circle cx="18" cy="18" r="15" fill="none" stroke="var(--line)" strokeWidth="5" />
                    <circle cx="18" cy="18" r="15" fill="none" stroke="var(--primary)" strokeWidth="5"
                      strokeDasharray={`${(sp.talk_pct / 100) * 94.2} 94.2`} transform="rotate(-90 18 18)" />
                  </svg>
                  {Math.round(sp.talk_pct)}%
                </span>
              </button>
            );
          })}
        </div>
      </section>
      {managing && <TopicsModal onClose={() => setManaging(false)} onChange={loadTopics} />}
    </div>
  );
}
