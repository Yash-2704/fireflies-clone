"use client";

import { Calendar, Clock, Filter, Tag as TagIcon, Users } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Avatar } from "@/components/ui/Avatar";
import { api, MeetingFilters, Participant, Tag } from "@/lib/api";

const SECTIONS = [
  { id: "participants", label: "Participants", icon: Users },
  { id: "date", label: "Date Range", icon: Calendar },
  { id: "duration", label: "Duration", icon: Clock },
  { id: "tags", label: "Tags", icon: TagIcon },
] as const;

const DURATIONS = [
  { label: "Under 5 min", max: 5 },
  { label: "5 – 30 min", min: 5, max: 30 },
  { label: "Over 30 min", min: 30 },
];

/** Fireflies-style two-pane filter menu for the meetings library. */
export function FiltersPopover({ value, onChange }: { value: MeetingFilters; onChange: (f: MeetingFilters) => void }) {
  const [open, setOpen] = useState(false);
  const [section, setSection] = useState<(typeof SECTIONS)[number]["id"]>("participants");
  const [people, setPeople] = useState<Participant[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [find, setFind] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    api.participants().then(setPeople).catch(() => {});
    api.tags().then(setTags).catch(() => {});
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const active = [
    value.participant_id?.length, value.date_from || value.date_to,
    value.min_duration != null || value.max_duration != null, value.tag,
  ].filter(Boolean).length;
  const selected = new Set(value.participant_id ?? []);

  const toggleParticipant = (id: number) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange({ ...value, participant_id: [...next] });
  };

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(!open)}
        className={`btn-ghost ${active ? "border-primary text-primary" : ""}`}>
        <Filter size={14} /> Filters{active ? ` · ${active}` : ""}
      </button>
      {open && (
        <div className="absolute left-0 top-10 z-40 flex h-72 w-[460px] overflow-hidden rounded-lg border border-line bg-panel shadow-2xl">
          <div className="flex w-40 flex-col border-r border-line p-1.5">
            {SECTIONS.map(({ id, label, icon: Icon }) => (
              <button key={id} onClick={() => setSection(id)}
                className={`flex items-center gap-2 rounded px-2 py-1.5 text-[13px] ${section === id ? "bg-primary-soft text-text" : "text-muted hover:bg-hover"}`}>
                <Icon size={14} /> {label}
              </button>
            ))}
            <button onClick={() => onChange({ q: value.q, sort: value.sort })}
              className="mt-auto rounded px-2 py-1.5 text-left text-xs text-muted hover:bg-hover">Clear all filters</button>
          </div>
          <div className="flex-1 overflow-y-auto p-3">
            {section === "participants" && (
              <>
                <input value={find} onChange={(e) => setFind(e.target.value)} placeholder="Search participants" className="input mb-2" />
                {people.filter((p) => p.name.toLowerCase().includes(find.toLowerCase())).map((p) => (
                  <label key={p.id} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-[13px] hover:bg-hover">
                    <input type="checkbox" checked={selected.has(p.id)} onChange={() => toggleParticipant(p.id)} className="accent-[var(--primary)]" />
                    <Avatar name={p.name} size={20} /> {p.name}
                  </label>
                ))}
              </>
            )}
            {section === "date" && (
              <div className="space-y-3 text-xs text-muted">
                <label className="block">From
                  <input type="date" className="input mt-1" value={value.date_from?.slice(0, 10) ?? ""}
                    onChange={(e) => onChange({ ...value, date_from: e.target.value ? `${e.target.value}T00:00:00` : undefined })} />
                </label>
                <label className="block">To
                  <input type="date" className="input mt-1" value={value.date_to?.slice(0, 10) ?? ""}
                    onChange={(e) => onChange({ ...value, date_to: e.target.value ? `${e.target.value}T23:59:59` : undefined })} />
                </label>
              </div>
            )}
            {section === "duration" && DURATIONS.map((d) => {
              const on = value.min_duration === d.min && value.max_duration === d.max;
              return (
                <label key={d.label} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-[13px] hover:bg-hover">
                  <input type="radio" checked={on} className="accent-[var(--primary)]"
                    onChange={() => onChange({ ...value, min_duration: d.min, max_duration: d.max })} />
                  {d.label}
                </label>
              );
            })}
            {section === "tags" && (
              <div className="flex flex-wrap gap-1.5">
                {tags.map((t) => (
                  <button key={t.id} onClick={() => onChange({ ...value, tag: value.tag === t.name ? undefined : t.name })}
                    className={`chip ${value.tag === t.name ? "border-primary text-text" : ""}`}>#{t.name}</button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
