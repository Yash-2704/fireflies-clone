"use client";

import { Copy, FileQuestion, Loader2, RefreshCw, Sparkles } from "lucide-react";
import { useState } from "react";

import { ActionItems } from "@/components/meeting/ActionItems";
import { Player } from "@/components/meeting/usePlayer";
import { Avatar } from "@/components/ui/Avatar";
import { useToast } from "@/components/ui/Toast";
import { copyAndNotify } from "@/lib/clipboard";
import { ActionItem, MeetingDetail } from "@/lib/api";
import { fmtDuration, fmtLongDate, fmtTime } from "@/lib/format";

const SOURCE_LABEL = { ai: "AI generated", heuristic: "Auto-generated (AI offline)", seed: "Sample notes" };

export function NotesPanel({ meeting, player, regenerating, onRegenerate, onActionItemsChange, onRename }: {
  meeting: MeetingDetail;
  player: Player;
  regenerating: boolean;
  onRegenerate: () => void;
  onActionItemsChange: (items: ActionItem[]) => void;
  onRename: (title: string) => Promise<void>;
}) {
  const [renaming, setRenaming] = useState(false);
  const toast = useToast();
  const summary = meeting.summary;

  const copy = () => {
    const text = [summary?.overview, ...meeting.chapters.map((c) => `• ${c.title}: ${c.summary}`)].join("\n");
    copyAndNotify(toast, text, "Notes copied");
  };

  return (
    <div className="mx-auto max-w-2xl px-8 py-8">
      {renaming ? (
        <form onSubmit={async (e) => {
          e.preventDefault();
          const title = (new FormData(e.currentTarget).get("title") as string).trim();
          if (title && title !== meeting.title) await onRename(title);
          setRenaming(false);
        }}>
          <input name="title" autoFocus defaultValue={meeting.title} onBlur={(e) => e.currentTarget.form?.requestSubmit()}
            onKeyDown={(e) => e.key === "Escape" && setRenaming(false)} aria-label="Meeting title"
            className="w-full rounded-md border border-primary bg-card px-2 py-1 text-2xl font-semibold tracking-tight outline-none" />
        </form>
      ) : (
        <h1 onClick={() => setRenaming(true)} title="Click to rename"
          className="-mx-2 cursor-text rounded-md px-2 py-1 text-2xl font-semibold tracking-tight hover:bg-card">{meeting.title}</h1>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-muted">
        <span className="flex items-center gap-1.5"><Avatar name={meeting.organizer.name} size={18} square />{meeting.organizer.name}</span>
        <span>{fmtLongDate(meeting.date)}</span>
        <span>{fmtDuration(meeting.duration_sec)}</span>
        {meeting.tags.map((t) => <span key={t.id} className="chip">#{t.name}</span>)}
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {meeting.participants.map((p) => (
          <span key={p.id} className="chip"><Avatar name={p.name} size={16} /> {p.name}</span>
        ))}
      </div>

      <div className="mt-8 flex items-center gap-2 text-[13px] text-muted">
        <Sparkles size={14} /> General Summary
        {summary && <span className="rounded bg-card px-1.5 py-0.5 text-[11px] text-faint">{SOURCE_LABEL[summary.source]}</span>}
        <div className="ml-auto flex gap-1">
          <button onClick={copy} disabled={!summary} aria-label="Copy notes" className="rounded p-1.5 hover:bg-hover"><Copy size={14} /></button>
          <button onClick={onRegenerate} disabled={regenerating} className="flex items-center gap-1 rounded px-2 py-1 hover:bg-hover">
            {regenerating ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />} Regenerate
          </button>
        </div>
      </div>

      {!summary?.overview ? (
        <div className="py-14 text-center">
          <FileQuestion size={26} className="mx-auto mb-3 text-faint" />
          <p className="font-medium">No meeting summary available</p>
          <p className="mt-1 text-[13px] text-muted">Meeting does not have enough transcript to generate a summary.</p>
        </div>
      ) : (
        <>
          <h2 className="mb-2 mt-5 text-[15px] font-semibold">Overview</h2>
          <p className="text-[14px] leading-relaxed text-text/90">{summary.overview}</p>

          {meeting.chapters.length > 0 && (
            <>
              <h2 className="mb-2 mt-7 text-[15px] font-semibold">Outline</h2>
              <ul className="space-y-3">
                {meeting.chapters.map((c) => (
                  <li key={c.id} className="text-[14px] leading-relaxed">
                    <span className="font-medium">{c.title}</span>{" "}
                    <button onClick={() => player.seek(c.start_sec)} className="text-link hover:underline">({fmtTime(c.start_sec)})</button>
                    {c.summary && <p className="text-muted">{c.summary}</p>}
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}

      <h2 className="mb-3 mt-8 text-[15px] font-semibold">Action items</h2>
      <ActionItems meeting={meeting} player={player} onChange={onActionItemsChange} />
    </div>
  );
}
