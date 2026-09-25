"use client";

import { ArrowDownUp, Hash, LayoutList, Search, Upload, Video } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { EditMeetingModal } from "@/components/library/EditMeetingModal";
import { FiltersPopover } from "@/components/library/FiltersPopover";
import { MeetingRow } from "@/components/library/MeetingRow";
import { NewMeetingModal } from "@/components/library/NewMeetingModal";
import { TopBar } from "@/components/shell/TopBar";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { useToast } from "@/components/ui/Toast";
import { api, MeetingFilters, MeetingListItem, Tag } from "@/lib/api";
import { dayGroup } from "@/lib/format";

export default function MeetingsPage() {
  const toast = useToast();
  const [filters, setFilters] = useState<MeetingFilters>({ sort: "recent" });
  const [search, setSearch] = useState("");
  const [meetings, setMeetings] = useState<MeetingListItem[] | null>(null);
  const [tags, setTags] = useState<Tag[]>([]);
  const [editing, setEditing] = useState<MeetingListItem | null>(null);
  const [deleting, setDeleting] = useState<MeetingListItem | null>(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(() => {
    api.meetings(filters).then((r) => setMeetings(r.meetings)).catch((e) => {
      toast.error(`Couldn't load meetings: ${e.message}`);
      setMeetings([]);
    });
  }, [filters, toast]);

  useEffect(load, [load]);
  useEffect(() => { api.tags().then(setTags).catch(() => {}); }, [meetings]);

  // Debounce typing into the title/participant search.
  useEffect(() => {
    const t = setTimeout(() => setFilters((f) => (f.q === search ? f : { ...f, q: search || undefined })), 250);
    return () => clearTimeout(t);
  }, [search]);

  const groups = useMemo(() => {
    const out: [string, MeetingListItem[]][] = [];
    for (const m of meetings ?? []) {
      const g = dayGroup(m.date);
      if (out.at(-1)?.[0] === g) out.at(-1)![1].push(m);
      else out.push([g, [m]]);
    }
    return out;
  }, [meetings]);

  async function remove(m: MeetingListItem) {
    try {
      await api.deleteMeeting(m.id);
      toast.success("Meeting deleted");
      load();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  const filtered = Object.entries(filters).some(([k, v]) => k !== "sort" && v !== undefined && (!Array.isArray(v) || v.length));

  return (
    <>
      <TopBar title="Meetings" />
      <div className="flex min-h-0 flex-1">
        <aside className="hidden w-56 shrink-0 flex-col border-r border-line p-3 md:flex">
          <button onClick={() => setFilters((f) => ({ ...f, tag: undefined }))}
            className={`flex items-center gap-2 rounded-md px-2.5 py-2 text-[13px] ${!filters.tag ? "bg-primary-soft text-text" : "text-muted hover:bg-hover"}`}>
            <LayoutList size={15} /> All Meetings
          </button>
          <p className="mb-1 mt-5 px-2.5 text-xs font-medium text-faint">Channels</p>
          {tags.map((t) => (
            <button key={t.id} onClick={() => setFilters((f) => ({ ...f, tag: t.name }))}
              className={`flex items-center gap-2 rounded-md px-2.5 py-1.5 text-[13px] ${filters.tag === t.name ? "bg-primary-soft text-text" : "text-muted hover:bg-hover"}`}>
              <Hash size={14} /> {t.name}
            </button>
          ))}
        </aside>

        <section className="flex min-w-0 flex-1 flex-col">
          <div className="flex flex-wrap items-center gap-2 border-b border-line px-5 py-3">
            <FiltersPopover value={filters} onChange={setFilters} />
            <div className="relative w-64">
              <Search size={14} className="absolute left-2.5 top-2.5 text-faint" />
              <input value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder="Filter by title or participant" className="input pl-8" />
            </div>
            <button onClick={() => setFilters((f) => ({ ...f, sort: f.sort === "oldest" ? "recent" : "oldest" }))}
              className="btn-ghost ml-auto">
              <ArrowDownUp size={14} /> {filters.sort === "oldest" ? "Oldest first" : "Most recent"}
            </button>
            <button onClick={() => setCreating(true)} className="btn-primary"><Upload size={14} /> Upload</button>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-4">
            <div className="mx-auto max-w-4xl">
              {meetings === null && [0, 1, 2].map((i) => <div key={i} className="mb-2 h-16 animate-pulse rounded-lg bg-card" />)}
              {meetings?.length === 0 && (
                <div className="py-20 text-center">
                  <Video size={28} className="mx-auto mb-4 text-faint" />
                  <p className="font-medium">{filtered ? "No meetings match these filters" : "Looks like you haven't added a meeting yet"}</p>
                  <p className="mt-1 text-[13px] text-muted">
                    {filtered ? "Try removing a filter." : "Upload or paste a transcript and it'll show up right here."}
                  </p>
                  {!filtered && <button onClick={() => setCreating(true)} className="btn-primary mx-auto mt-5">+ Add meeting</button>}
                </div>
              )}
              {groups.map(([label, items]) => (
                <div key={label} className="mb-5">
                  <p className="mb-2 text-[13px] font-medium text-muted">{label}</p>
                  <div className="space-y-2">
                    {items.map((m) => (
                      <MeetingRow key={m.id} meeting={m} onEdit={() => setEditing(m)} onDelete={() => setDeleting(m)} />
                    ))}
                  </div>
                </div>
              ))}
              {!!meetings?.length && <p className="py-4 text-center text-xs text-faint">You&apos;ve reached the end of your meetings.</p>}
            </div>
          </div>
        </section>
      </div>

      {creating && <NewMeetingModal onClose={() => setCreating(false)} />}
      {editing && <EditMeetingModal meeting={editing} onClose={() => setEditing(null)} onSaved={load} />}
      {deleting && (
        <ConfirmModal title="Delete meeting?" onClose={() => setDeleting(null)} onConfirm={() => remove(deleting)}
          message={<>“{deleting.title}” and its transcript, notes and action items will be permanently deleted.</>} />
      )}
    </>
  );
}
