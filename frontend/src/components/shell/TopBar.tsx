"use client";

import { Bell, Search, UserPlus, Video } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { NewMeetingModal } from "@/components/library/NewMeetingModal";
import { SearchModal } from "@/components/shell/SearchModal";

export function TopBar({ title }: { title: React.ReactNode }) {
  const [searching, setSearching] = useState(false);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearching(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <header className="flex h-14 shrink-0 items-center gap-4 border-b border-line px-4">
      <div className="min-w-0 flex-1 truncate text-[14px] font-medium">{title}</div>
      <button onClick={() => setSearching(true)}
        className="hidden w-80 items-center gap-2 rounded-md border border-line bg-card px-3 py-1.5 text-[13px] text-faint hover:border-faint md:flex">
        <Search size={14} /> <span className="flex-1 text-left">Search by title or keyword</span>
        <kbd className="text-[11px]">⌘K</kbd>
      </button>
      <div className="flex flex-1 items-center justify-end gap-2">
        <button aria-label="Notifications" className="relative rounded-md p-2 text-muted hover:bg-hover">
          <Bell size={17} />
          <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-red-500" />
        </button>
        <Link href="/team" className="btn-ghost hidden sm:inline-flex"><UserPlus size={15} /> Invite</Link>
        <button onClick={() => setCreating(true)} className="btn-primary"><Video size={15} /> Capture</button>
      </div>
      {searching && <SearchModal onClose={() => setSearching(false)} />}
      {creating && <NewMeetingModal onClose={() => setCreating(false)} />}
    </header>
  );
}
