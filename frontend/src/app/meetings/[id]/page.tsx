"use client";

import { X, Bookmark as BookmarkIcon, Download, FileText, MessageSquare, Scissors, Search, Video, Info, Link2, MoreHorizontal, PanelLeftClose, PanelLeftOpen, Printer, RefreshCw, Share2, Trash2 } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";

import { EditMeetingModal } from "@/components/library/EditMeetingModal";
import { BookmarksPanel, CommentsPanel, SoundbitesPanel } from "@/components/meeting/AnnotationPanels";
import { AskFredPanel } from "@/components/meeting/AskFredPanel";
import { MeetingMedia } from "@/components/meeting/MeetingMedia";
import { NotesPanel } from "@/components/meeting/NotesPanel";
import { PlayerBar } from "@/components/meeting/PlayerBar";
import { SmartSearchPanel } from "@/components/meeting/SmartSearchPanel";
import { TranscriptFilter, TranscriptPanel } from "@/components/meeting/TranscriptPanel";
import { Annotations, useAnnotations } from "@/components/meeting/useAnnotations";
import { ShareModal } from "@/components/meeting/ShareModal";
import { usePlayer } from "@/components/meeting/usePlayer";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { useToast } from "@/components/ui/Toast";
import { copyAndNotify } from "@/lib/clipboard";
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

type LeftPanel = "search" | "soundbites" | "comments" | "bookmarks";

function MeetingView({ meeting, setMeeting }: { meeting: MeetingDetail; setMeeting: (m: MeetingDetail) => void }) {
  const router = useRouter();
  const toast = useToast();
  const params = useSearchParams();
  const player = usePlayer(meeting.duration_sec);
  const [leftPanel, setLeftPanel] = useState<LeftPanel>("search");
  // The left panel sits inline on wide screens and opens as an overlay below 1024px, so start
  // it closed there. (MeetingView only renders client-side, after the meeting has loaded.)
  const [panelOpen, setPanelOpen] = useState(() => window.innerWidth >= 1024);
  const base = useAnnotations(meeting, setMeeting);
  const reveal = (panel: LeftPanel) => { setLeftPanel(panel); setPanelOpen(true); setMobilePane("highlights"); };
  // Creating a soundbite/comment from the transcript opens its panel so the result is visible.
  const annotations: Annotations = {
    ...base,
    addSoundbite: async (...a) => { const ok = await base.addSoundbite(...a); if (ok) reveal("soundbites"); return ok; },
    addComment: async (...a) => { const ok = await base.addComment(...a); if (ok) reveal("comments"); return ok; },
  };
  const [tab, setTab] = useState<"askfred" | "transcript">("transcript");
  const [filter, setFilter] = useState<TranscriptFilter>(null);
  const [sharing, setSharing] = useState(false);
  const [menu, setMenu] = useState(false);
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [showVideo, setShowVideo] = useState(true);
  // Phones show one column at a time: the notes, or the transcript/AskFred panel.
  const [mobilePane, setMobilePane] = useState<"notes" | "side" | "highlights">("notes");
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
    { label: "Copy link", icon: Link2, run: () => copyAndNotify(toast, location.href, "Link copied") },
    { label: "Regenerate notes", icon: RefreshCw, run: regenerate },
    { label: "Meeting info", icon: Info, run: () => setEditing(true) },
    { label: "Download notes (.md)", icon: Download, run: () => exportNotesMarkdown(meeting) },
    { label: "Download transcript (.txt)", icon: FileText, run: () => exportTranscriptTxt(meeting) },
    { label: "Print / Save as PDF", icon: Printer, run: () => window.print() },
  ];

  return (
    <>
      <header className="flex h-14 shrink-0 items-center gap-2 border-b border-line px-4 print:hidden">
        <button onClick={() => setPanelOpen(!panelOpen)} aria-label="Toggle side panel" className="rounded p-1.5 text-muted hover:bg-hover max-md:hidden">
          {panelOpen ? <PanelLeftClose size={17} /> : <PanelLeftOpen size={17} />}
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
        <button onClick={() => setSharing(true)}
          className={`btn-primary ${meeting.media_type === "video" ? "" : "ml-auto"}`}><Share2 size={14} /> Share</button>
      </header>

      <div className="flex shrink-0 border-b border-line md:hidden print:hidden">
        {([["notes", "Notes"], ["transcript", "Transcript"], ["askfred", "AskFred"], ["highlights", "Highlights"]] as const).map(([id, label]) => {
          const active = id === "notes" || id === "highlights" ? mobilePane === id : mobilePane === "side" && tab === id;
          return (
            <button key={id} onClick={() => {
              if (id === "notes" || id === "highlights") setMobilePane(id);
              else { setMobilePane("side"); setTab(id); }
              if (id === "highlights") setPanelOpen(true);
            }}
              className={`flex-1 border-b-2 py-2.5 text-[13px] ${active ? "border-primary text-primary" : "border-transparent text-muted"}`}>
              {label}
            </button>
          );
        })}
      </div>

      <div className="flex min-h-0 flex-1">
        <aside className={`relative shrink-0 border-r border-line bg-panel print:hidden md:flex ${mobilePane === "highlights" ? "flex max-md:w-full" : "hidden"}`}>
          {/* Fireflies-style mini rail: Smart Search · Soundbites · Comments · Bookmarks */}
          <div className="flex w-11 shrink-0 flex-col items-center gap-1 border-r border-line py-2">
            {([
              ["search", "Smart Search", Search, 0],
              ["soundbites", "Soundbites", Scissors, meeting.soundbites.length],
              ["comments", "Comments", MessageSquare, meeting.comments.length],
              ["bookmarks", "Bookmarks", BookmarkIcon, meeting.bookmarks.length],
            ] as const).map(([id, label, Icon, count]) => (
              <button key={id} title={label} aria-label={label} aria-pressed={panelOpen && leftPanel === id}
                onClick={() => { setPanelOpen(!(panelOpen && leftPanel === id)); setLeftPanel(id); }}
                className={`relative rounded-md p-2 ${panelOpen && leftPanel === id ? "bg-primary-soft text-primary" : "text-muted hover:bg-hover hover:text-text"}`}>
                <Icon size={16} />
                {count > 0 && <span className="absolute -right-0.5 -top-0.5 rounded-full bg-primary px-1 text-[9px] leading-3 text-white">{count}</span>}
              </button>
            ))}
          </div>
          {/* Inline at ≥1024px; an overlay drawer between tablet and 1024px; full width on phones. */}
          <div className={`${panelOpen ? "flex" : "hidden"} w-72 flex-col overflow-hidden bg-panel max-lg:absolute max-lg:inset-y-0 max-lg:left-11 max-lg:z-20 max-lg:border-r max-lg:border-line max-lg:shadow-2xl max-md:static max-md:flex-1 max-md:shadow-none`}>
            <div className="flex items-center border-b border-line px-4 py-3 text-[13px] font-medium">
              {{ search: "Smart Search", soundbites: `Soundbites · ${meeting.soundbites.length}`,
                 comments: `Comments · ${meeting.comments.length}`, bookmarks: `Bookmarks · ${meeting.bookmarks.length}` }[leftPanel]}
              <button onClick={() => setPanelOpen(false)} aria-label="Close panel" className="ml-auto rounded p-1 text-faint hover:bg-hover hover:text-text lg:hidden max-md:hidden">
                <X size={14} />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              {leftPanel === "search" && <SmartSearchPanel meeting={meeting} filter={filter} onFilter={applyFilter} />}
              {leftPanel === "soundbites" && <SoundbitesPanel meeting={meeting} player={player} annotations={annotations} />}
              {leftPanel === "comments" && <CommentsPanel meeting={meeting} player={player} annotations={annotations} userName={meeting.organizer.name} />}
              {leftPanel === "bookmarks" && <BookmarksPanel meeting={meeting} player={player} annotations={annotations} />}
            </div>
          </div>
        </aside>
        <section className={`min-w-0 flex-1 overflow-y-auto ${mobilePane !== "notes" ? "max-md:hidden" : ""}`}>
          {meeting.media_url && meeting.media_type && (
            <MeetingMedia url={meeting.media_url} type={meeting.media_type} showVideo={showVideo}
              onElement={player.attachMedia} onClick={player.toggle} />
          )}
          <NotesPanel meeting={meeting} player={player} regenerating={regenerating} onRegenerate={regenerate}
            onActionItemsChange={(action_items) => setMeeting({ ...meeting, action_items })}
            onRename={async (title) => {
              try {
                setMeeting(await api.updateMeeting(meeting.id, { title }));
                toast.success("Meeting renamed");
              } catch (e) {
                toast.error((e as Error).message);
              }
            }} />
        </section>
        <aside className={`relative flex w-[420px] shrink-0 flex-col border-l border-line bg-panel print:hidden ${mobilePane !== "side" ? "max-md:hidden" : "max-md:w-full"}`}>
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
              annotations={annotations}
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

      <div className="print:hidden"><PlayerBar player={player} bookmarks={meeting.bookmarks} onBookmark={annotations.addBookmark} /></div>

      {sharing && <ShareModal meeting={meeting} currentTime={player.time} onClose={() => setSharing(false)} />}
      {editing && <EditMeetingModal meeting={meeting} onClose={() => setEditing(false)} onSaved={setMeeting} />}
      {deleting && (
        <ConfirmModal title="Delete meeting?" onClose={() => setDeleting(false)} onConfirm={remove}
          message={<>“{meeting.title}” and its transcript, notes and action items will be permanently deleted.</>} />
      )}
    </>
  );
}
