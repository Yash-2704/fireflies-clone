"use client";

import { ChevronDown, ChevronUp, Copy, Link2, MessageSquare, Pencil, Scissors, Search, Undo2, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { Annotations, BOOKMARK_KINDS } from "@/components/meeting/useAnnotations";
import { Player } from "@/components/meeting/usePlayer";
import { Avatar } from "@/components/ui/Avatar";
import { countMatches, Highlight } from "@/components/ui/Highlight";
import { useToast } from "@/components/ui/Toast";
import { BookmarkKind, MeetingDetail } from "@/lib/api";
import { fmtTime } from "@/lib/format";

export type TranscriptFilter = { label: string; segmentIds: Set<number> } | null;

type Selection = { text: string; firstId: number; lastId: number; x: number; y: number } | null;

export function TranscriptPanel({ meeting, player, filter, onClearFilter, onRenameSpeaker, annotations }: {
  meeting: MeetingDetail;
  player: Player;
  filter: TranscriptFilter;
  onClearFilter: () => void;
  onRenameSpeaker: (speakerId: number, name: string) => Promise<void>;
  annotations: Annotations;
}) {
  const toast = useToast();
  const [query, setQuery] = useState("");
  const [matchIndex, setMatchIndex] = useState(0);
  const [following, setFollowing] = useState(true);
  const [renaming, setRenaming] = useState<number | null>(null);
  const [editing, setEditing] = useState<number | null>(null);
  const [selection, setSelection] = useState<Selection>(null);
  const [commenting, setCommenting] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const rows = useRef(new Map<number, HTMLDivElement>());

  const speakers = useMemo(() => new Map(meeting.speakers.map((s) => [s.id, s])), [meeting.speakers]);
  const byId = useMemo(() => new Map(meeting.segments.map((s) => [s.id, s])), [meeting.segments]);
  const segments = filter ? meeting.segments.filter((s) => filter.segmentIds.has(s.id)) : meeting.segments;
  const commentCounts = useMemo(() => {
    const counts = new Map<number, number>();
    meeting.comments.forEach((c) => counts.set(c.segment_id, (counts.get(c.segment_id) ?? 0) + 1));
    return counts;
  }, [meeting.comments]);

  // Active line = last segment that has started. Segments are sorted by start time.
  const activeId = useMemo(() => {
    let id: number | null = null;
    for (const s of meeting.segments) {
      if (s.start_sec <= player.time) id = s.id;
      else break;
    }
    return id;
  }, [meeting.segments, player.time]);

  // Bookmarks shown on the line they fall in.
  const marksByLine = useMemo(() => {
    const out = new Map<number, BookmarkKind[]>();
    for (const b of meeting.bookmarks) {
      let id = meeting.segments[0]?.id;
      for (const s of meeting.segments) if (s.start_sec <= b.at_sec) id = s.id;
      if (id != null) out.set(id, [...(out.get(id) ?? []), b.kind]);
    }
    return out;
  }, [meeting.bookmarks, meeting.segments]);

  // Flatten matches so ↑/↓ can step through them in order: [segmentId, nth match in segment].
  const matches = useMemo(
    () => segments.flatMap((s) => Array.from({ length: countMatches(s.text, query) }, (_, n) => [s.id, n] as const)),
    [segments, query],
  );
  const current = matches[Math.min(matchIndex, matches.length - 1)];

  function scrollTo(el: HTMLElement | undefined) {
    const box = scroller.current;
    if (!box || !el) return;
    const top = el.getBoundingClientRect().top - box.getBoundingClientRect().top + box.scrollTop;
    box.scrollTo({ top: top - box.clientHeight / 3, behavior: "smooth" });
  }

  useEffect(() => {
    if (current) scrollTo(rows.current.get(current[0])?.querySelector("mark.current") as HTMLElement);
  }, [current]);
  useEffect(() => {
    if (following && activeId != null && !query) scrollTo(rows.current.get(activeId));
  }, [activeId, following, query]);

  // Close the selection toolbar when clicking anywhere outside it.
  const toolbar = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!selection) return;
    const close = (e: MouseEvent) => !toolbar.current?.contains(e.target as Node) && setSelection(null);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [selection]);

  const step = (d: number) => matches.length && setMatchIndex((i) => (i + d + matches.length) % matches.length);

  // Text selection → floating toolbar (Fireflies: Create soundbite / Comment / Bookmark / Copy).
  function onMouseUp() {
    const sel = window.getSelection();
    const text = sel?.toString().replace(/\s+/g, " ").trim();
    if (!sel || !text || sel.rangeCount === 0) return setSelection(null);
    const lineOf = (n: Node | null) => (n instanceof Element ? n : n?.parentElement)?.closest<HTMLElement>("[data-seg]");
    const a = lineOf(sel.anchorNode), b = lineOf(sel.focusNode);
    if (!a || !b || !scroller.current?.contains(a)) return setSelection(null);
    const ids = [Number(a.dataset.seg), Number(b.dataset.seg)];
    const [firstId, lastId] = byId.get(ids[0])!.start_sec <= byId.get(ids[1])!.start_sec ? ids : [ids[1], ids[0]];
    const rect = sel.getRangeAt(0).getBoundingClientRect();
    setCommenting(false);
    setSelection({ text, firstId, lastId, x: rect.left + rect.width / 2, y: rect.top });
  }

  function closeSelection() {
    window.getSelection()?.removeAllRanges();
    setSelection(null);
  }

  const copyMomentLink = (sec: number) =>
    navigator.clipboard.writeText(`${location.origin}/meetings/${meeting.id}?t=${Math.floor(sec)}`)
      .then(() => toast.success(`Link to ${fmtTime(sec)} copied`));

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-2 px-4 py-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-2.5 top-2.5 text-faint" />
          <input value={query} onChange={(e) => { setQuery(e.target.value); setMatchIndex(0); }} placeholder="Find in transcript"
            onKeyDown={(e) => e.key === "Enter" && step(e.shiftKey ? -1 : 1)} className="input pl-8 pr-24" />
          {query && (
            <div className="absolute right-1.5 top-1.5 flex items-center gap-0.5 text-xs text-muted">
              <span className="px-1 tabular-nums">{matches.length ? `${Math.min(matchIndex, matches.length - 1) + 1} of ${matches.length}` : "0 results"}</span>
              <button onClick={() => step(-1)} aria-label="Previous match" className="rounded p-0.5 hover:bg-hover"><ChevronUp size={14} /></button>
              <button onClick={() => step(1)} aria-label="Next match" className="rounded p-0.5 hover:bg-hover"><ChevronDown size={14} /></button>
            </div>
          )}
        </div>
      </div>
      {filter && (
        <div className="mx-4 mb-2 flex items-center justify-between rounded-md bg-primary-soft px-3 py-1.5 text-xs">
          <span>Showing <b>{filter.label}</b> · {segments.length} lines</span>
          <button onClick={onClearFilter} aria-label="Clear filter" className="text-muted hover:text-text"><X size={13} /></button>
        </div>
      )}

      <div ref={scroller} onMouseUp={onMouseUp} onWheel={() => player.playing && setFollowing(false)} onTouchMove={() => setFollowing(false)}
        onScroll={() => selection && setSelection(null)}
        className="relative min-h-0 flex-1 overflow-y-auto px-4 pb-6">
        {segments.map((s) => {
          const sp = speakers.get(s.speaker_id)!;
          const active = s.id === activeId;
          const comments = commentCounts.get(s.id);
          return (
            <div key={s.id} data-seg={s.id} ref={(el) => { if (el) rows.current.set(s.id, el); else rows.current.delete(s.id); }}
              className={`group mb-1 rounded-lg px-2 py-2 transition-colors ${active ? "bg-primary-soft" : "hover:bg-card"}`}>
              {/* select-none: selecting across lines should capture only the spoken text */}
              <div className="mb-1 flex select-none items-center gap-2 text-[13px]">
                <Avatar name={sp.name} size={20} square />
                {renaming === sp.id ? (
                  <form onSubmit={async (e) => {
                    e.preventDefault();
                    const name = new FormData(e.currentTarget).get("name") as string;
                    if (name.trim() && name.trim() !== sp.name) await onRenameSpeaker(sp.id, name.trim());
                    setRenaming(null);
                  }}>
                    <input name="name" autoFocus defaultValue={sp.name} onBlur={() => setRenaming(null)}
                      className="input h-6 w-40 py-0" aria-label="Speaker name" />
                  </form>
                ) : (
                  <button onClick={() => setRenaming(sp.id)} title="Rename speaker" className="flex items-center gap-0.5 font-medium hover:underline">
                    {sp.name} <ChevronDown size={12} className="text-faint opacity-0 group-hover:opacity-100" />
                  </button>
                )}
                <span className="text-faint">·</span>
                <button onClick={() => player.seek(s.start_sec)} className="text-xs text-link hover:underline">
                  {fmtTime(s.start_sec)}
                </button>
                {marksByLine.get(s.id)?.map((k, i) => {
                  const { icon: Icon, color, label } = BOOKMARK_KINDS[k];
                  return <Icon key={i} size={12} style={{ color }} aria-label={label} />;
                })}
                {comments && <span className="flex items-center gap-0.5 text-xs text-muted"><MessageSquare size={11} />{comments}</span>}
                <span className="ml-auto flex gap-1 opacity-0 group-hover:opacity-100">
                  <button onClick={() => copyMomentLink(s.start_sec)} title="Copy link to this moment" className="rounded p-1 text-faint hover:bg-hover hover:text-text">
                    <Link2 size={13} />
                  </button>
                  <button onClick={() => setEditing(s.id)} title="Edit line" className="rounded p-1 text-faint hover:bg-hover hover:text-text">
                    <Pencil size={13} />
                  </button>
                </span>
              </div>
              {editing === s.id ? (
                <form className="pl-7" onSubmit={async (e) => {
                  e.preventDefault();
                  const text = (new FormData(e.currentTarget).get("text") as string).trim();
                  if (text && text !== s.text) await annotations.editSegment(s.id, text);
                  setEditing(null);
                }}>
                  <textarea name="text" autoFocus defaultValue={s.text} rows={3} className="input text-[13px]"
                    onKeyDown={(e) => { if (e.key === "Escape") setEditing(null); if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); e.currentTarget.form?.requestSubmit(); } }} />
                  <div className="mt-1.5 flex justify-end gap-2">
                    <button type="button" onClick={() => setEditing(null)} className="btn-ghost py-1">Cancel</button>
                    <button className="btn-primary py-1">Save</button>
                  </div>
                </form>
              ) : (
                <p onClick={() => !window.getSelection()?.toString() && player.seek(s.start_sec)}
                  className={`cursor-pointer pl-7 text-[13.5px] leading-relaxed ${active ? "text-text" : "text-muted"}`}>
                  <Highlight text={s.text} query={query} currentIndex={current?.[0] === s.id ? current[1] : undefined} />
                </p>
              )}
            </div>
          );
        })}
        {segments.length === 0 && <p className="py-10 text-center text-[13px] text-muted">No transcript lines.</p>}
      </div>

      {selection && (
        <div ref={toolbar} style={{ left: selection.x, top: selection.y - 8 }} onMouseDown={(e) => e.preventDefault()}
          className="fixed z-50 -translate-x-1/2 -translate-y-full rounded-lg border border-line bg-panel p-1 shadow-2xl">
          {commenting ? (
            <form className="flex w-72 gap-1" onSubmit={(e) => {
              e.preventDefault();
              const body = (new FormData(e.currentTarget).get("body") as string).trim();
              if (body) annotations.addComment(selection.firstId, body);
              closeSelection();
            }}>
              <input name="body" autoFocus placeholder={`Comment at ${fmtTime(byId.get(selection.firstId)!.start_sec)}`}
                className="input py-1" onMouseDown={(e) => e.stopPropagation()} />
              <button className="btn-primary py-1">Post</button>
            </form>
          ) : (
            <div className="flex items-center gap-0.5 text-xs">
              <button onClick={() => {
                const first = byId.get(selection.firstId)!, last = byId.get(selection.lastId)!;
                const title = selection.text.length > 60 ? `${selection.text.slice(0, 57)}…` : selection.text;
                annotations.addSoundbite(title, first.start_sec, last.end_sec);
                closeSelection();
              }} className="flex items-center gap-1 whitespace-nowrap rounded px-2 py-1.5 hover:bg-hover"><Scissors size={13} /> Create soundbite</button>
              <button onClick={() => setCommenting(true)} className="flex items-center gap-1 rounded px-2 py-1.5 hover:bg-hover">
                <MessageSquare size={13} /> Comment
              </button>
              {(Object.keys(BOOKMARK_KINDS) as BookmarkKind[]).map((k) => {
                const { icon: Icon, color, label } = BOOKMARK_KINDS[k];
                return (
                  <button key={k} title={`Bookmark as ${label}`} aria-label={`Bookmark as ${label}`}
                    onClick={() => { annotations.addBookmark(k, byId.get(selection.firstId)!.start_sec); closeSelection(); }}
                    className="rounded p-1.5 hover:bg-hover"><Icon size={13} style={{ color }} /></button>
                );
              })}
              <button onClick={() => navigator.clipboard.writeText(selection.text).then(() => { toast.success("Copied"); closeSelection(); })}
                title="Copy" className="rounded p-1.5 hover:bg-hover"><Copy size={13} /></button>
            </div>
          )}
        </div>
      )}

      {!following && player.playing && (
        <button onClick={() => { setFollowing(true); scrollTo(rows.current.get(activeId ?? -1)); }}
          className="absolute bottom-20 right-8 z-10 flex items-center gap-1.5 rounded-full border border-line bg-card px-3 py-1.5 text-xs shadow-lg hover:bg-hover">
          <Undo2 size={13} /> Sync with audio
        </button>
      )}
    </div>
  );
}
