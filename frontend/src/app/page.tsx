"use client";

import { Calendar, ChevronRight, Plus, Upload } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { NewMeetingModal } from "@/components/library/NewMeetingModal";
import { TopBar } from "@/components/shell/TopBar";
import { Avatar } from "@/components/ui/Avatar";
import { useToast } from "@/components/ui/Toast";
import { api, MeetingListItem, Task, User } from "@/lib/api";
import { fmtDateTime, fmtDuration } from "@/lib/format";

export default function HomePage() {
  const toast = useToast();
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [recent, setRecent] = useState<MeetingListItem[] | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [tab, setTab] = useState<"recent" | "tasks">("recent");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    api.me().then(setUser).catch(() => {});
    api.meetings().then((r) => setRecent(r.meetings.slice(0, 5))).catch((e) => {
      toast.error(`Couldn't reach the API: ${e.message}`);
      setRecent([]);
    });
    api.tasks("open").then(setTasks).catch(() => {});
  }, [toast]);

  const quickStart = [
    { label: "Schedule Meeting", icon: Calendar, tint: "bg-[#3a1a22] text-[#f08aa4]", run: () => toast.success("Calendar integration is coming soon") },
    { label: "Upload File", icon: Upload, tint: "bg-[#15302a] text-[#6fd3a8]", run: () => setCreating(true) },
    { label: "Capture Meeting", icon: Plus, tint: "bg-[#241c42] text-[#a996ff]", run: () => router.push("/live") },
  ];

  return (
    <>
      <TopBar title="Home" />
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-6 py-8">
          <div className="rounded-2xl border border-[#5a3a1c] bg-gradient-to-br from-[#3b2412] to-[#24170c] px-8 py-8">
            <h1 className="text-xl font-semibold text-[#f5e6d8]">Welcome back{user ? `, ${user.name.split(" ")[0]}` : ""}!</h1>
            <p className="mt-2 max-w-md text-[13px] text-[#d9c2ad]">
              Upload a transcript and Fireflies writes the summary, outline and action items. Ask Fred anything about your meetings.
            </p>
          </div>

          <h2 className="mt-8 text-[17px] font-semibold">Quick Start</h2>
          <p className="text-[13px] text-muted">Add a meeting to see Fireflies in action.</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            {quickStart.map(({ label, icon: Icon, tint, run }) => (
              <button key={label} onClick={run}
                className={`flex items-center gap-3 rounded-lg px-4 py-3.5 text-left text-[13px] font-medium ${tint} hover:brightness-125`}>
                <Icon size={16} /> <span className="flex-1">{label}</span> <ChevronRight size={14} />
              </button>
            ))}
          </div>

          <div className="mt-8 flex items-center justify-between">
            <div className="inline-flex rounded-md bg-card p-0.5 text-[13px]">
              {(["recent", "tasks"] as const).map((t) => (
                <button key={t} onClick={() => setTab(t)} className={`rounded px-3 py-1 ${tab === t ? "bg-hover text-text" : "text-muted"}`}>
                  {t === "recent" ? "Recent" : `My Tasks · ${tasks.length}`}
                </button>
              ))}
            </div>
            <Link href={tab === "recent" ? "/meetings" : "/tasks"} className="text-[13px] text-muted hover:text-text">View all</Link>
          </div>

          <div className="mt-3 space-y-1">
            {tab === "recent" && recent?.map((m) => (
              <Link key={m.id} href={`/meetings/${m.id}`} className="flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-card">
                <Avatar name={m.title} size={32} square />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13.5px] font-medium">{m.title}</p>
                  <p className="text-xs text-muted">{fmtDateTime(m.date)} · {fmtDuration(m.duration_sec)}</p>
                </div>
              </Link>
            ))}
            {tab === "recent" && recent?.length === 0 && <p className="py-6 text-center text-[13px] text-muted">No meetings yet.</p>}
            {tab === "tasks" && tasks.slice(0, 6).map((t) => (
              <Link key={t.id} href={`/meetings/${t.meeting_id}`} className="flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-card">
                <span className="h-4 w-4 rounded border border-faint" />
                <span className="flex-1 truncate text-[13.5px]">{t.text}</span>
                <span className="truncate text-xs text-muted">{t.meeting_title}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>
      {creating && <NewMeetingModal onClose={() => setCreating(false)} />}
    </>
  );
}
