"use client";

import { ChevronRight, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { Avatar } from "@/components/ui/Avatar";
import { MeetingListItem } from "@/lib/api";
import { fmtDateTime, fmtDuration } from "@/lib/format";

export function MeetingRow({ meeting, onEdit, onDelete }: {
  meeting: MeetingListItem;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [menu, setMenu] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menu) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setMenu(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [menu]);

  return (
    <div className="group relative flex items-center gap-3 rounded-lg border border-line bg-panel px-4 py-3 hover:bg-card">
      <Avatar name={meeting.organizer.name} size={36} square />
      <Link href={`/meetings/${meeting.id}`} className="min-w-0 flex-1">
        <p className="flex items-center gap-1 truncate text-[14px] font-medium">
          {meeting.title} <ChevronRight size={14} className="text-faint" />
        </p>
        <p className="mt-0.5 truncate text-xs text-muted">
          {fmtDateTime(meeting.date)} · {fmtDuration(meeting.duration_sec)} · {meeting.organizer.name.split(" ")[0]}
          {meeting.tags.map((t) => <span key={t.id} className="ml-2 text-faint">#{t.name}</span>)}
        </p>
      </Link>
      <div className="hidden -space-x-1.5 sm:flex">
        {meeting.participants.slice(0, 4).map((p) => (
          <span key={p.id} className="rounded-full ring-2 ring-[var(--panel)]"><Avatar name={p.name} size={24} /></span>
        ))}
        {meeting.participants.length > 4 && (
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-hover text-[10px] text-muted ring-2 ring-[var(--panel)]">
            +{meeting.participants.length - 4}
          </span>
        )}
      </div>
      <div ref={ref} className="relative flex items-center gap-2 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
        <button onClick={() => setMenu(!menu)} aria-label="More actions" className="rounded-md border border-line p-1.5 text-muted hover:bg-hover">
          <MoreHorizontal size={15} />
        </button>
        <Link href={`/meetings/${meeting.id}`} className="btn-ghost">Details <ChevronRight size={14} /></Link>
        {menu && (
          <div className="absolute right-0 top-9 z-30 w-40 rounded-lg border border-line bg-panel p-1 shadow-xl">
            <button onClick={() => { setMenu(false); onEdit(); }} className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-[13px] hover:bg-hover">
              <Pencil size={13} /> Edit details
            </button>
            <button onClick={() => { setMenu(false); onDelete(); }} className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-[13px] text-red-400 hover:bg-hover">
              <Trash2 size={13} /> Delete
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
