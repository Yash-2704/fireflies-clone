"use client";

import { Calendar, ChevronDown, ClipboardPaste, Radio, Search, Upload, UserPlus, Video } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { NewMeetingModal } from "@/components/library/NewMeetingModal";
import { NotificationsMenu } from "@/components/shell/NotificationsMenu";
import { SearchModal } from "@/components/shell/SearchModal";
import { useToast } from "@/components/ui/Toast";

export function TopBar({ title }: { title: React.ReactNode }) {
  const [searching, setSearching] = useState(false);
  const [creating, setCreating] = useState<"upload" | "paste" | null>(null);
  const [captureOpen, setCaptureOpen] = useState(false);
  const captureRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const toast = useToast();

  useEffect(() => {
    if (!captureOpen) return;
    const close = (e: MouseEvent) => !captureRef.current?.contains(e.target as Node) && setCaptureOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [captureOpen]);

  const captureItems = [
    { label: "Upload audio or video", icon: Upload, run: () => setCreating("upload") },
    { label: "Paste a transcript", icon: ClipboardPaste, run: () => setCreating("paste") },
    { label: "Schedule new meeting", icon: Calendar, run: () => toast.success("Calendar scheduling is coming soon") },
    { label: "Add to live meeting", icon: Radio, run: () => router.push("/live") },
  ];

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
        <NotificationsMenu />
        <Link href="/team" className="btn-ghost hidden sm:inline-flex"><UserPlus size={15} /> Invite</Link>
        <div ref={captureRef} className="relative">
          <button onClick={() => setCaptureOpen(!captureOpen)} aria-expanded={captureOpen} className="btn-primary">
            <Video size={15} /> Capture <ChevronDown size={14} />
          </button>
          {captureOpen && (
            <div className="absolute right-0 top-10 z-50 w-56 rounded-lg border border-line bg-panel p-1 shadow-2xl">
              {captureItems.map(({ label, icon: Icon, run }) => (
                <button key={label} onClick={() => { setCaptureOpen(false); run(); }}
                  className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-[13px] hover:bg-hover">
                  <Icon size={14} className="text-muted" /> {label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      {searching && <SearchModal onClose={() => setSearching(false)} />}
      {creating && <NewMeetingModal initialMode={creating} onClose={() => setCreating(null)} />}
    </header>
  );
}
