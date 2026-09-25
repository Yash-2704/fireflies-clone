"use client";

import { Calendar, CalendarClock, ChevronRight, ListChecks, Plus, Scissors, Upload } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { NewMeetingModal } from "@/components/library/NewMeetingModal";
import { TopBar } from "@/components/shell/TopBar";
import { WorkspaceAskFred } from "@/components/shell/WorkspaceAskFred";
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
  const [tab, setTab] = useState<"recent" | "upcoming" | "tasks">("recent");
  const [creating, setCreating] = useState(false);
  // Time-dependent values are computed in the browser after load (not during render).
  const [greeting, setGreeting] = useState("Welcome back");
  const [thisWeek, setThisWeek] = useState(0);

  useEffect(() => {
    api.me().then((u) => {
      const hour = new Date().getHours();
      setGreeting(hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening");
      setUser(u);
    }).catch(() => {});
    api.meetings().then((r) => {
      const weekAgo = Date.now() - 7 * 86_400_000;
      setThisWeek(r.meetings.filter((m) => new Date(m.date).getTime() >= weekAgo).length);
      setRecent(r.meetings.slice(0, 5));
    }).catch((e) => {
      toast.error(`Couldn't reach the API: ${e.message}`);
      setRecent([]);
    });
    api.tasks("open").then(setTasks).catch(() => {});
  }, [toast]);


  const quickStart = [
    { label: "Schedule Meeting", icon: Calendar, tint: "bg-[#3a1a22] text-[#f08aa4]", run: () => toast.success("Calendar integration is coming soon") },
    { label: "Upload Recording", icon: Upload, tint: "bg-[#15302a] text-[#6fd3a8]", run: () => setCreating(true) },
    { label: "Capture Meeting", icon: Plus, tint: "bg-[#241c42] text-[#a996ff]", run: () => router.push("/live") },
  ];

  return (
    <>
      <TopBar title="Home" />
      <div className="flex min-h-0 flex-1">
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-6 py-8">
          <div className="rounded-2xl border border-[#5a3a1c] bg-gradient-to-br from-[#3b2412] to-[#24170c] px-8 py-8">
            <h1 className="text-xl font-semibold text-[#f5e6d8]">{greeting}{user ? `, ${user.name.split(" ")[0]}` : ""}!</h1>
            <p className="mt-2 max-w-md text-[13px] text-[#d9c2ad]">
              Upload a recording or transcript and Fireflies transcribes it and writes the summary, outline and action items.
              Ask Fred anything across your meetings.
            </p>
          </div>

          <h2 className="mt-8 text-[17px] font-semibold">Personal Assistant</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            {[
              { icon: CalendarClock, label: "This week", value: `${thisWeek} meeting${thisWeek === 1 ? "" : "s"}`, href: "/meetings" },
              { icon: ListChecks, label: "Tasks", value: `${tasks.length} open`, href: "/tasks" },
              { icon: Scissors, label: "Highlights", value: "Soundbites & bookmarks", href: recent?.[0] ? `/meetings/${recent[0].id}` : "/meetings" },
            ].map(({ icon: Icon, label, value, href }) => (
              <Link key={label} href={href} className="rounded-lg border border-line bg-panel p-4 hover:bg-card">
                <Icon size={18} className="mb-3 text-primary" />
                <p className="text-[13px] font-medium">{label}</p>
                <p className="text-xs text-muted">{value}</p>
              </Link>
            ))}
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
              {(["recent", "upcoming", "tasks"] as const).map((t) => (
                <button key={t} onClick={() => setTab(t)} className={`rounded px-3 py-1 ${tab === t ? "bg-hover text-text" : "text-muted"}`}>
                  {{ recent: "Recent", upcoming: "Upcoming", tasks: `My Tasks · ${tasks.length}` }[t]}
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
            {tab === "upcoming" && (
              <div className="py-10 text-center">
                <Calendar size={22} className="mx-auto mb-3 text-faint" />
                <p className="text-[13px] font-medium">No upcoming meeting scheduled</p>
                <p className="mt-1 text-xs text-muted">Calendar sync is coming soon. Meanwhile, upload a recording to get notes.</p>
                <button onClick={() => setCreating(true)} className="btn-primary mx-auto mt-4"><Upload size={14} /> Upload recording</button>
              </div>
            )}
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
      <WorkspaceAskFred userName={user?.name ?? ""} />
      </div>
      {creating && <NewMeetingModal onClose={() => setCreating(false)} />}
    </>
  );
}
