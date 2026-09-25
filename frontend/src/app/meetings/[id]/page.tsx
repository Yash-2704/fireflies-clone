"use client";

import { Download, FileText, Video, Info, Link2, MoreHorizontal, PanelLeftClose, PanelLeftOpen, Printer, RefreshCw, Share2, Trash2 } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";

import { EditMeetingModal } from "@/components/library/EditMeetingModal";
import { AskFredPanel } from "@/components/meeting/AskFredPanel";
import { MeetingMedia } from "@/components/meeting/MeetingMedia";
import { NotesPanel } from "@/components/meeting/NotesPanel";
import { PlayerBar } from "@/components/meeting/PlayerBar";
import { SmartSearchPanel } from "@/components/meeting/SmartSearchPanel";
import { TranscriptFilter, TranscriptPanel } from "@/components/meeting/TranscriptPanel";
import { usePlayer } from "@/components/meeting/usePlayer";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { useToast } from "@/components/ui/Toast";
import { api, MeetingDetail } from "@/lib/api";
import { exportNotesMarkdown, exportTranscriptTxt } from "@/lib/export";

export default function MeetingPage() {
  const { id } = useParams<{ id: string }>();
  const [meeting, setMeeting] = useState<MeetingDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.meeting(Number(id)).then(setMeeting).catch((e) => setError(e.message));
  }, [id]);

  if (error) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3">
        <p className="font-medium">{error}</p>
        <Link href="/meetings" className="btn-ghost">Back to meetings</Link>
      </div>
    );
  }
  if (!meeting) return <div className="flex flex-1 items-center justify-center text-muted">Loading meeting…</div>;
  return <Suspense><MeetingView meeting={meeting} setMeeting={setMeeting} /></Suspense>;
}

function MeetingView({ meeting, setMeeting }: { meeting: MeetingDetail; setMeeting: (m: MeetingDetail) => void }) {
  const router = useRouter();
  const toast = useToast();
  const params = useSearchParams();
  const player = usePlayer(meeting.duration_sec);
  const [tab, setTab] = useState<"askfred" | "transcript">("transcript");
  const [filter, setFilter] = useState<TranscriptFilter>(null);
  const [leftOpen, setLeftOpen] = useState(true);
  const [menu, setMenu] = useState(false);
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [showVideo, setShowVideo] = useState(true);
  // Phones show one column at a time: the notes, or the transcript/AskFred panel.
  const [mobilePane, setMobilePane] = useState<"notes" | "side">("notes");
  const menuRef = useRef<HTMLDivElement>(null);

  // Deep link from global search: /meetings/3?t=125 opens the transcript at that moment.
  useEffect(() => {
    const t = params.get("t");
    if (t) player.seek(Number(t));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  useEffect(() => {
    if (!menu) return;
    const close = (e: MouseEvent) => !menuRef.current?.contains(e.target as Node) && setMenu(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [menu]);

  // Filtering from the left panel only makes sense while looking at the transcript.
  const applyFilter = (f: TranscriptFilter) => { setFilter(f); if (f) setTab("transcript"); };

  async function regenerate() {
    setRegenerating(true);
    try {
      const m = await api.regenerateNotes(meeting.id);
      setMeeting(m);
      toast.success(m.summary?.source === "ai" ? "Notes regenerated with AI" : "AI unavailable — generated basic notes");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setRegenerating(false);
    }
  }

  async function remove() {
    try {
      await api.deleteMeeting(meeting.id);
      toast.success("Meeting deleted");
      router.push("/meetings");
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  const menuItems = [
    { label: "Copy link", icon: Link2, run: () => navigator.clipboard.writeText(location.href).then(() => toast.success("Link copied")) },
    { label: "Regenerate notes", icon: RefreshCw, run: regenerate },
    { label: "Meeting info", icon: Info, run: () => setEditing(true) },
    { label: "Download notes (.md)", icon: Download, run: () => exportNotesMarkdown(meeting) },
    { label: "Download transcript (.txt)", icon: FileText, run: () => exportTranscriptTxt(meeting) },
    { label: "Print / Save as PDF", icon: Printer, run: () => window.print() },
  ];

  return (
    <>
      <header className="flex h-14 shrink-0 items-center gap-2 border-b border-line px-4 print:hidden">
        <button onClick={() => setLeftOpen(!leftOpen)} aria-label="Toggle smart search" className="rounded p-1.5 text-muted hover:bg-hover">
          {leftOpen ? <PanelLeftClose size={17} /> : <PanelLeftOpen size={17} />}
        </button>
        <Link href="/meetings" className="text-[13px] text-muted hover:text-text">All Meetings</Link>
        <span className="text-faint">/</span>
        <span className="truncate text-[13px]">{meeting.title}</span>
        <div ref={menuRef} className="relative">
          <button onClick={() => setMenu(!menu)} aria-label="Meeting actions" className="rounded p-1.5 text-muted hover:bg-hover">
            <MoreHorizontal size={16} />
          </button>
          {menu && (
            <div className="absolute left-0 top-9 z-30 w-56 rounded-lg border border-line bg-panel p-1 shadow-xl">
              {menuItems.map(({ label, icon: Icon, run }) => (
                <button key={label} onClick={() => { setMenu(false); run(); }}
                  className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-[13px] hover:bg-hover">
                  <Icon size={14} className="text-muted" /> {label}
                </button>
              ))}
              <div className="my-1 border-t border-line" />
              <button onClick={() => { setMenu(false); setDeleting(true); }}
                className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-[13px] text-red-400 hover:bg-hover">
                <Trash2 size={14} /> Delete
              </button>
            </div>
          )}
        </div>
        {meeting.media_type === "video" && (
          <button onClick={() => setShowVideo(!showVideo)} className={`btn-ghost ml-auto ${showVideo ? "border-primary" : ""}`}>
            <Video size={14} /> Video
          </button>
        )}
        <button onClick={() => navigator.clipboard.writeText(location.href).then(() => toast.success("Link copied — sharing with teammates is coming soon"))}
          className={`btn-primary ${meeting.media_type === "video" ? "" : "ml-auto"}`}><Share2 size={14} /> Share</button>
      </header>

      <div className="flex shrink-0 border-b border-line md:hidden print:hidden">
        {([["notes", "Notes"], ["transcript", "Transcript"], ["askfred", "AskFred"]] as const).map(([id, label]) => {
          const active = id === "notes" ? mobilePane === "notes" : mobilePane === "side" && tab === id;
          return (
            <button key={id} onClick={() => { setMobilePane(id === "notes" ? "notes" : "side"); if (id !== "notes") setTab(id); }}
              className={`flex-1 border-b-2 py-2.5 text-[13px] ${active ? "border-primary text-primary" : "border-transparent text-muted"}`}>
              {label}
            </button>
          );
        })}
      </div>

      <div className="flex min-h-0 flex-1">
        {leftOpen && (
          <aside className="hidden w-72 shrink-0 overflow-y-auto border-r border-line bg-panel lg:block print:hidden">
            <div className="border-b border-line px-4 py-3 text-[13px] font-medium">Smart Search</div>
            <SmartSearchPanel meeting={meeting} filter={filter} onFilter={applyFilter} />
          </aside>
        )}
        <section className={`min-w-0 flex-1 overflow-y-auto ${mobilePane === "side" ? "max-md:hidden" : ""}`}>
          {meeting.media_url && meeting.media_type && (
            <MeetingMedia url={meeting.media_url} type={meeting.media_type} showVideo={showVideo}
              onElement={player.attachMedia} onClick={player.toggle} />
          )}
          <NotesPanel meeting={meeting} player={player} regenerating={regenerating} onRegenerate={regenerate}
            onActionItemsChange={(action_items) => setMeeting({ ...meeting, action_items })} />
        </section>
        <aside className={`relative flex w-[420px] shrink-0 flex-col border-l border-line bg-panel print:hidden ${mobilePane === "notes" ? "max-md:hidden" : "max-md:w-full"}`}>
          <div className="flex gap-4 border-b border-line px-4 max-md:hidden">
            {(["askfred", "transcript"] as const).map((t) => (
              <button key={t} onClick={() => setTab(t)}
                className={`-mb-px border-b-2 py-3 text-[13px] ${tab === t ? "border-primary text-primary" : "border-transparent text-muted hover:text-text"}`}>
                {t === "askfred" ? "AskFred" : "Transcript"}
              </button>
            ))}
          </div>
          {/* Both tabs stay mounted so the AskFred conversation survives switching tabs. */}
          <div className={tab === "transcript" ? "flex min-h-0 flex-1 flex-col" : "hidden"}>
            <TranscriptPanel meeting={meeting} player={player} filter={filter} onClearFilter={() => setFilter(null)}
              onRenameSpeaker={async (sid, name) => {
                try {
                  setMeeting(await api.renameSpeaker(meeting.id, sid, name));
                  toast.success(`Speaker renamed to ${name}`);
                } catch (e) {
                  toast.error((e as Error).message);
                }
              }} />
          </div>
          <div className={tab === "askfred" ? "flex min-h-0 flex-1 flex-col" : "hidden"}>
            <AskFredPanel meeting={meeting} player={player} />
          </div>
        </aside>
      </div>

      <div className="print:hidden"><PlayerBar player={player} /></div>

      {editing && <EditMeetingModal meeting={meeting} onClose={() => setEditing(false)} onSaved={setMeeting} />}
      {deleting && (
        <ConfirmModal title="Delete meeting?" onClose={() => setDeleting(false)} onConfirm={remove}
          message={<>“{meeting.title}” and its transcript, notes and action items will be permanently deleted.</>} />
      )}
    </>
  );
}
