"use client";

import { Download, Filter, Hash, Settings2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { DailyChart } from "@/components/analytics/DailyChart";
import { delta, StatCard } from "@/components/analytics/StatCard";
import { TopicsModal } from "@/components/analytics/TopicsModal";
import { SearchModal } from "@/components/shell/SearchModal";
import { TopBar } from "@/components/shell/TopBar";
import { Avatar } from "@/components/ui/Avatar";
import { useToast } from "@/components/ui/Toast";
import { AnalyticsFilters, api, Participant, Tag, TeamInsights, TopicInsight } from "@/lib/api";
import { fmtTime } from "@/lib/format";

type Range = "today" | "7d" | "30d" | "custom";

// Backend dates are naive local times, so send local "YYYY-MM-DDTHH:MM:SS" (no timezone).
const localIso = (d: Date) =>
  new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 19);

function rangeDates(range: Range, custom: { from: string; to: string }) {
  const now = new Date();
  if (range === "custom") {
    return { date_from: `${custom.from}T00:00:00`, date_to: `${custom.to}T23:59:59` };
  }
  const start = new Date(now);
  if (range === "today") start.setHours(0, 0, 0, 0);
  else start.setDate(now.getDate() - (range === "7d" ? 7 : 30));
  return { date_from: localIso(start), date_to: localIso(now) };
}

const mins = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, "0")}`;
const hrs = (sec: number) => `${Math.floor(sec / 3600)}:${String(Math.round((sec % 3600) / 60)).padStart(2, "0")} hrs`;

export default function AnalyticsPage() {
  const toast = useToast();
  const [tab, setTab] = useState<"team" | "topics">("team");
  const [range, setRange] = useState<Range>("7d");
  const [custom, setCustom] = useState(() => {
    const today = localIso(new Date()).slice(0, 10);
    return { from: today, to: today };
  });
  const [people, setPeople] = useState<number[]>([]);
  const [tag, setTag] = useState<string | undefined>();
  const [team, setTeam] = useState<TeamInsights | null>(null);
  const [topics, setTopics] = useState<TopicInsight[] | null>(null);
  const [managing, setManaging] = useState(false);
  const [searchFor, setSearchFor] = useState<string | null>(null);

  const filters: AnalyticsFilters = useMemo(
    () => ({ ...rangeDates(range, custom), participant_id: people, tag }), [range, custom, people, tag]);

  const load = useCallback(() => {
    api.teamInsights(filters).then(setTeam).catch((e) => toast.error(e.message));
    api.topicInsights(filters).then(setTopics).catch((e) => toast.error(e.message));
  }, [filters, toast]);
  useEffect(load, [load]);

  function exportCsv() {
    if (!team) return;
    const c = team.current, p = team.previous;
    const rows = [
      ["Metric", "Current period", "Previous period"],
      ["Conversations", c.conversations, p.conversations],
      ["Time in conversations (min)", Math.round(c.duration_sec / 60), Math.round(p.duration_sec / 60)],
      ["Questions asked", c.questions, p.questions],
      ["Filler words", c.fillers, p.fillers],
      ["Monologues", c.monologues, p.monologues],
      ["Longest monologue (s)", c.longest_monologue_sec, p.longest_monologue_sec],
      ["Your talk share (%)", c.talk_pct ?? "", p.talk_pct ?? ""],
      ["Words per minute", c.wpm, p.wpm],
      ["Silence (s)", c.silence_sec, p.silence_sec],
      [],
      ["Speaker", "Meetings", "Talk time (s)", "WPM", "Questions", "Longest monologue (s)"],
      ...c.speakers.map((s) => [s.name, s.meetings, s.talk_sec, s.wpm, s.questions, s.longest_monologue_sec]),
    ];
    const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    Object.assign(document.createElement("a"), { href: url, download: `team-insights-${team.from.slice(0, 10)}.csv` }).click();
    URL.revokeObjectURL(url);
  }

  const c = team?.current, p = team?.previous;

  return (
    <>
      <TopBar title="Analytics" />
      <div className="flex-1 overflow-y-auto">
        <div className="flex justify-center gap-6 border-b border-line">
          {([["team", "Team Insights"], ["topics", "Topic Insights"]] as const).map(([id, label]) => (
            <button key={id} onClick={() => setTab(id)}
              className={`-mb-px border-b-2 py-3 text-[13px] ${tab === id ? "border-primary text-primary" : "border-transparent text-muted hover:text-text"}`}>
              {label}
            </button>
          ))}
        </div>

        <div className="mx-auto max-w-6xl px-6 py-5">
          <div className="mb-4 flex flex-wrap items-center justify-end gap-2">
            {tab === "team" && <button onClick={exportCsv} disabled={!team} className="btn-ghost"><Download size={14} /> Export</button>}
            {tab === "topics" && <button onClick={() => setManaging(true)} className="btn-ghost"><Settings2 size={14} /> Manage topics</button>}
            <AnalyticsFilterMenu people={people} setPeople={setPeople} tag={tag} setTag={setTag} />
            <select value={range} onChange={(e) => setRange(e.target.value as Range)} aria-label="Date range"
              className="input w-auto py-1.5">
              <option value="today">Today</option>
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="custom">Custom date range</option>
            </select>
            {range === "custom" && (
              <>
                <input type="date" value={custom.from} max={custom.to} aria-label="From"
                  onChange={(e) => setCustom({ ...custom, from: e.target.value })} className="input w-auto py-1.5" />
                <input type="date" value={custom.to} min={custom.from} aria-label="To"
                  onChange={(e) => setCustom({ ...custom, to: e.target.value })} className="input w-auto py-1.5" />
              </>
            )}
          </div>

          {tab === "team" && (!c || !p ? <Skeleton /> : (
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <StatCard title="Total number of conversations" value={c.conversations} current={c.conversations} previous={p.conversations}
                  info="Meetings in the selected period (matching the filters)." />
                <StatCard title="Total time spent in conversations" value={hrs(c.duration_sec)} current={c.duration_sec} previous={p.duration_sec}
                  info="Sum of meeting durations in the selected period." />
              </div>
              <p className="rounded-lg bg-primary-soft px-4 py-2.5 text-xs text-muted">
                Speaker metrics use the transcript&apos;s speaker labels — rename “Speaker 1” to a real name in any meeting&apos;s transcript for accurate per-person analytics.
              </p>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard title="Total number of questions asked" value={c.questions} current={c.questions} previous={p.questions}
                  info="Question marks in transcript lines — each question asked by anyone." />
                <StatCard title="Total number of filler words" value={c.fillers} current={c.fillers} previous={p.fillers}
                  info="Words like um, uh, you know, basically, actually, sort of, kind of, I mean." />
                <StatCard title="Total number of monologues" value={c.monologues} current={c.monologues} previous={p.monologues}
                  info="A single speaker talking for 30 seconds or more without being interrupted." />
                <StatCard title="Longest monologue" value={`${mins(c.longest_monologue_sec)} mins`} current={c.longest_monologue_sec} previous={p.longest_monologue_sec}
                  info="The longest uninterrupted stretch by one speaker." />
                <StatCard title="Your talk to listen ratio"
                  info="Share of speaking time that was you, in meetings where you spoke (based on your name as a speaker).">
                  {c.talk_pct == null ? (
                    <p className="mt-3 text-sm text-muted">You didn&apos;t speak in these meetings.</p>
                  ) : (
                    <>
                      <div className="mt-3 flex gap-5 text-2xl font-semibold tabular-nums">
                        <span>{Math.round(c.talk_pct)}%</span><span className="text-muted">{100 - Math.round(c.talk_pct)}%</span>
                      </div>
                      <div className="mt-1 flex gap-9 text-xs text-muted"><span>Talk</span><span>Listen</span></div>
                      <div className="mt-2 flex h-1.5 gap-0.5 overflow-hidden rounded-full">
                        <span className="rounded-full bg-primary" style={{ width: `${c.talk_pct}%` }} />
                        <span className="flex-1 rounded-full bg-line" />
                      </div>
                    </>
                  )}
                </StatCard>
                <StatCard title="Average words spoken per minute (WPM)" value={c.wpm} current={c.wpm} previous={p.wpm}
                  info="Total words ÷ total speaking time across all speakers." />
                <StatCard title="Total silence duration" value={`${mins(c.silence_sec)} mins`} current={c.silence_sec} previous={p.silence_sec}
                  info="Gaps of 1 second or more between consecutive transcript lines." />
                <StatCard title="Previous period" info="The same length of time immediately before the selected range, used for the ▲/▼ comparisons.">
                  <p className="mt-3 text-sm">{p.conversations} conversations · {hrs(p.duration_sec)}</p>
                  <p className="mt-1 text-xs text-muted">Conversations {delta(c.conversations, p.conversations)}</p>
                </StatCard>
              </div>

              {team && <DailyChart from={team.from} to={team.to} daily={team.daily} />}

              <div className="overflow-x-auto rounded-xl border border-line bg-panel">
                <h3 className="px-4 pt-4 text-[13px] text-muted">Speakers</h3>
                <table className="mt-2 w-full min-w-[560px] text-left text-[13px]">
                  <thead className="text-xs text-faint">
                    <tr>{["Speaker", "Meetings", "Talk time", "WPM", "Questions asked", "Longest monologue"].map((h) => (
                      <th key={h} className="px-4 py-2 font-normal">{h}</th>))}</tr>
                  </thead>
                  <tbody>
                    {c.speakers.map((s) => (
                      <tr key={s.name} className="border-t border-line">
                        <td className="px-4 py-2"><span className="flex items-center gap-2"><Avatar name={s.name} size={20} square />{s.name}</span></td>
                        <td className="px-4 py-2 tabular-nums">{s.meetings}</td>
                        <td className="px-4 py-2 tabular-nums">{fmtTime(s.talk_sec)}</td>
                        <td className="px-4 py-2 tabular-nums">{s.wpm}</td>
                        <td className="px-4 py-2 tabular-nums">{s.questions}</td>
                        <td className="px-4 py-2 tabular-nums">{s.longest_monologue_sec ? `${Math.round(s.longest_monologue_sec)}s` : "—"}</td>
                      </tr>
                    ))}
                    {!c.speakers.length && <tr><td colSpan={6} className="px-4 py-6 text-center text-muted">No meetings in this period.</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          ))}

          {tab === "topics" && (topics === null ? <Skeleton /> : topics.length === 0 ? (
            <div className="py-20 text-center">
              <Hash size={26} className="mx-auto mb-3 text-primary" />
              <p className="text-lg font-semibold">No topics found for the given criteria</p>
              <p className="mt-1 text-[13px] text-muted">Creating topics helps you track and highlight important parts of meetings easily.</p>
              <button onClick={() => setManaging(true)} className="btn-primary mx-auto mt-5">Create topics</button>
            </div>
          ) : (
            <>
              <p className="mb-4 text-[13px] text-muted">
                Track keywords like competitor names or action items, and see how often they come up.{" "}
                <button onClick={() => setManaging(true)} className="text-link hover:underline">Manage in Topic Tracker →</button>
              </p>
              <div className="grid gap-4 md:grid-cols-2">
                {topics.map((t) => {
                  const hits = t.keywords.filter((k) => k.mentions > 0);
                  const top = Math.max(1, ...hits.map((k) => k.mentions));
                  return (
                    <div key={t.id} className="rounded-xl border border-line bg-panel p-4">
                      <h3 className="mb-3 flex items-center gap-1.5 text-[14px] font-medium"><Hash size={14} className="text-primary" />{t.name}</h3>
                      <div className="grid grid-cols-[1fr_2fr_auto_auto] items-center gap-x-3 gap-y-2 text-[13px]">
                        <span className="text-xs text-faint">Keywords ({hits.length})</span><span />
                        <span className="text-right text-xs text-faint">Conversations ({t.conversations})</span>
                        <span className="text-right text-xs text-faint">Mentions ({t.mentions})</span>
                        {hits.map((k) => (
                          <div key={k.keyword} className="contents">
                            <button onClick={() => setSearchFor(k.keyword)} title={`Search meetings for “${k.keyword}”`}
                              className="truncate text-left underline decoration-line underline-offset-2 hover:text-link">{k.keyword}</button>
                            <span className="h-1.5 rounded-full bg-line" title={`${k.mentions} mentions`}>
                              <span className="block h-full rounded-full bg-primary" style={{ width: `${(k.mentions / top) * 100}%` }} />
                            </span>
                            <span className="text-right tabular-nums">{k.conversations}</span>
                            <span className="text-right tabular-nums">{k.mentions}</span>
                          </div>
                        ))}
                      </div>
                      {!hits.length && <p className="text-xs text-muted">No mentions of {t.keywords.join(", ")} in this period.</p>}
                    </div>
                  );
                })}
              </div>
            </>
          ))}

        </div>
      </div>
      {managing && <TopicsModal onClose={() => setManaging(false)} onChange={load} />}
      {searchFor && <SearchModal initialQuery={searchFor} onClose={() => setSearchFor(null)} />}
    </>
  );
}

const Skeleton = () => (
  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
    {Array.from({ length: 8 }, (_, i) => <div key={i} className="h-28 animate-pulse rounded-xl bg-card" />)}
  </div>
);

/** Participants + tag filter for analytics. */
function AnalyticsFilterMenu({ people, setPeople, tag, setTag }: {
  people: number[]; setPeople: (p: number[]) => void; tag?: string; setTag: (t?: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const ref = useRef<HTMLDivElement>(null);
  const active = people.length + (tag ? 1 : 0);

  useEffect(() => {
    if (!open) return;
    api.participants().then(setParticipants).catch(() => {});
    api.tags().then(setTags).catch(() => {});
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(!open)} className={`btn-ghost ${active ? "border-primary text-primary" : ""}`}>
        <Filter size={14} /> Filters{active ? ` · ${active}` : ""}
      </button>
      {open && (
        <div className="absolute right-0 top-10 z-40 w-72 rounded-lg border border-line bg-panel p-3 shadow-2xl">
          <p className="mb-1.5 text-xs text-faint">Channel</p>
          <select value={tag ?? ""} onChange={(e) => setTag(e.target.value || undefined)} aria-label="Channel" className="input mb-3 py-1.5">
            <option value="">All meetings</option>
            {tags.map((t) => <option key={t.id} value={t.name}>#{t.name}</option>)}
          </select>
          <p className="mb-1.5 text-xs text-faint">Participants</p>
          <div className="max-h-52 overflow-y-auto">
            {participants.map((pp) => (
              <label key={pp.id} className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-[13px] hover:bg-hover">
                <input type="checkbox" checked={people.includes(pp.id)} className="accent-[var(--primary)]"
                  onChange={() => setPeople(people.includes(pp.id) ? people.filter((x) => x !== pp.id) : [...people, pp.id])} />
                <Avatar name={pp.name} size={18} /> {pp.name}
              </label>
            ))}
          </div>
          {active > 0 && <button onClick={() => { setPeople([]); setTag(undefined); }} className="mt-2 text-xs text-muted hover:text-text">Clear filters</button>}
        </div>
      )}
    </div>
  );
}
