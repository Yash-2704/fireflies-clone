"use client";

import { Link2, MessageSquare, Pause, Play, Scissors, Trash2 } from "lucide-react";
import { useState } from "react";

import { Annotations, BOOKMARK_KINDS } from "@/components/meeting/useAnnotations";
import { Player } from "@/components/meeting/usePlayer";
import { Avatar } from "@/components/ui/Avatar";
import { useToast } from "@/components/ui/Toast";
import { copyAndNotify } from "@/lib/clipboard";
import { BookmarkKind, MeetingDetail, Segment } from "@/lib/api";
import { fmtTime } from "@/lib/format";

/** The line playing at time t (last one that has started). */
export function segmentAt(segments: Segment[], t: number) {
  let found = segments[0];
  for (const s of segments) {
    if (s.start_sec <= t) found = s;
    else break;
  }
  return found;
}

function Empty({ icon: Icon, title, hint }: { icon: typeof Play; title: string; hint: string }) {
  return (
    <div className="px-4 py-12 text-center">
      <Icon size={22} className="mx-auto mb-3 text-faint" />
      <p className="text-[13px] font-medium">{title}</p>
      <p className="mt-1 text-xs text-muted">{hint}</p>
    </div>
  );
}

const DeleteButton = ({ onClick, label }: { onClick: () => void; label: string }) => (
  <button onClick={onClick} aria-label={label} className="text-faint opacity-0 hover:text-red-400 group-hover:opacity-100">
    <Trash2 size={13} />
  </button>
);

export function SoundbitesPanel({ meeting, player, annotations }: { meeting: MeetingDetail; player: Player; annotations: Annotations }) {
  const toast = useToast();
  if (!meeting.soundbites.length) {
    return <Empty icon={Scissors} title="No soundbites yet" hint="Select text in the transcript and choose “Create soundbite” to clip a moment." />;
  }
  return (
    <div className="space-y-2 p-3">
      {meeting.soundbites.map((s) => {
        const playing = player.playing && player.time >= s.start_sec && player.time < s.end_sec;
        const progress = Math.min(100, Math.max(0, ((player.time - s.start_sec) / (s.end_sec - s.start_sec)) * 100));
        return (
          <div key={s.id} className={`group rounded-lg border bg-card p-2.5 ${playing ? "border-primary" : "border-line"}`}>
            <div className="flex items-center gap-3">
              <button onClick={() => (playing ? player.toggle() : player.playRange(s.start_sec, s.end_sec))}
                aria-label={`${playing ? "Pause" : "Play"} ${s.title}`}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary-soft text-primary hover:bg-primary hover:text-white">
                {playing ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" />}
              </button>
              <div className="min-w-0 flex-1">
                <p className="line-clamp-2 text-[13px] font-medium">{s.title}</p>
                <p className="text-xs text-muted">{fmtTime(s.start_sec)} – {fmtTime(s.end_sec)} · {Math.round(s.end_sec - s.start_sec)}s{playing && " · Now playing"}</p>
              </div>
            </div>
            {playing && <div className="mt-2 h-0.5 rounded bg-line"><div className="h-full rounded bg-primary" style={{ width: `${progress}%` }} /></div>}
            <div className="mt-2 flex gap-1 text-xs opacity-0 group-hover:opacity-100 group-focus-within:opacity-100">
              <button onClick={() => copyAndNotify(toast, `${location.origin}/meetings/${meeting.id}?t=${Math.floor(s.start_sec)}`, "Soundbite link copied")}
                className="flex items-center gap-1 rounded px-1.5 py-0.5 text-muted hover:bg-hover hover:text-text"><Link2 size={12} /> Copy link</button>
              <button onClick={() => annotations.deleteSoundbite(s.id)}
                className="flex items-center gap-1 rounded px-1.5 py-0.5 text-muted hover:bg-hover hover:text-red-400"><Trash2 size={12} /> Delete</button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function CommentsPanel({ meeting, player, annotations, userName }: {
  meeting: MeetingDetail; player: Player; annotations: Annotations; userName: string;
}) {
  const [draft, setDraft] = useState("");
  const segments = new Map(meeting.segments.map((s) => [s.id, s]));
  const current = segmentAt(meeting.segments, player.time);

  return (
    <div className="flex h-full flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {!meeting.comments.length && (
          <Empty icon={MessageSquare} title="No discussion started yet" hint="Comment on a moment — select transcript text, or type below to comment on the line that's playing." />
        )}
        {meeting.comments.map((c) => {
          const seg = segments.get(c.segment_id);
          return (
            <div key={c.id} className="group mb-3 rounded-lg border border-line bg-card p-3">
              <div className="mb-1.5 flex items-center gap-2 text-xs">
                <Avatar name={userName} size={18} />
                <span className="font-medium">{userName}</span>
                <span className="text-faint">{new Date(c.created_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span>
                <span className="ml-auto"><DeleteButton onClick={() => annotations.deleteComment(c.id)} label="Delete comment" /></span>
              </div>
              <p className="text-[13px]">{c.body}</p>
              {seg && (
                <button onClick={() => player.seek(seg.start_sec)}
                  className="mt-2 block w-full border-l-2 border-primary pl-2 text-left text-xs text-muted hover:text-text">
                  <span className="text-link">{fmtTime(seg.start_sec)}</span> {seg.text.slice(0, 90)}{seg.text.length > 90 ? "…" : ""}
                </button>
              )}
            </div>
          );
        })}
      </div>
      {current && (
        <form className="border-t border-line p-3" onSubmit={(e) => {
          e.preventDefault();
          if (!draft.trim()) return;
          annotations.addComment(current.id, draft.trim());
          setDraft("");
        }}>
          <p className="mb-1.5 text-[11px] text-faint">Commenting at {fmtTime(current.start_sec)}</p>
          <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Comment…" className="input" />
        </form>
      )}
    </div>
  );
}

export function BookmarksPanel({ meeting, player, annotations }: { meeting: MeetingDetail; player: Player; annotations: Annotations }) {
  const [kind, setKind] = useState<BookmarkKind | "all">("all");
  const shown = meeting.bookmarks.filter((b) => kind === "all" || b.kind === kind);

  return (
    <div className="p-3">
      <div className="mb-3 flex flex-wrap gap-1.5">
        {(["all", ...Object.keys(BOOKMARK_KINDS)] as (BookmarkKind | "all")[]).map((k) => (
          <button key={k} onClick={() => setKind(k)} className={`chip ${kind === k ? "border-primary text-text" : ""}`}>
            {k === "all" ? "All" : BOOKMARK_KINDS[k].label} · {meeting.bookmarks.filter((b) => k === "all" || b.kind === k).length}
          </button>
        ))}
      </div>
      {!shown.length && <Empty icon={BOOKMARK_KINDS.important.icon} title="No bookmarks yet" hint="Use ☆ ☑ 👍 👎 in the player bar, or select transcript text, to mark key moments." />}
      {shown.map((b) => {
        const { icon: Icon, color, label } = BOOKMARK_KINDS[b.kind];
        const line = segmentAt(meeting.segments, b.at_sec);
        return (
          <div key={b.id} className="group mb-2 flex items-start gap-2.5 rounded-lg border border-line bg-card p-2.5">
            <Icon size={15} style={{ color }} className="mt-0.5 shrink-0" aria-label={label} />
            <button onClick={() => player.seek(b.at_sec)} className="min-w-0 flex-1 text-left">
              <p className="text-xs text-link">{fmtTime(b.at_sec)} · {label}</p>
              {line && <p className="line-clamp-2 text-[13px] text-muted">{line.text}</p>}
            </button>
            <DeleteButton onClick={() => annotations.deleteBookmark(b.id)} label="Delete bookmark" />
          </div>
        );
      })}
    </div>
  );
}
