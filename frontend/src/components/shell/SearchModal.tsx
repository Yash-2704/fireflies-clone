"use client";

import { FileText, Search, Video } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { api, SearchHit } from "@/lib/api";
import { fmtTime } from "@/lib/format";
import { Highlight } from "@/components/ui/Highlight";

/** ⌘K global search across meeting titles and transcripts. */
export function SearchModal({ onClose, initialQuery = "" }: { onClose: () => void; initialQuery?: string }) {
  const router = useRouter();
  const [q, setQ] = useState(initialQuery);
  const [results, setHits] = useState<SearchHit[] | null>(null);
  const tooShort = q.trim().length < 2;
  const hits = tooShort ? null : results;

  useEffect(() => {
    if (q.trim().length < 2) return;
    const t = setTimeout(() => api.search(q.trim()).then(setHits).catch(() => setHits([])), 200);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const open = (h: SearchHit) => {
    onClose();
    router.push(`/meetings/${h.meeting_id}${h.start_sec != null ? `?t=${Math.floor(h.start_sec)}` : ""}`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 px-4 pt-[12vh]" onMouseDown={onClose}>
      <div className="w-full max-w-xl overflow-hidden rounded-xl border border-line bg-panel shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()} role="dialog" aria-label="Search meetings">
        <div className="flex items-center gap-2 border-b border-line px-4 py-3">
          <Search size={16} className="text-muted" />
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="Search by title or keyword across all meetings"
            className="flex-1 bg-transparent text-[14px] outline-none placeholder:text-faint" />
          {q && <button onClick={() => setQ("")} className="text-xs text-muted hover:text-text">Clear</button>}
        </div>
        <div className="max-h-[55vh] overflow-y-auto p-2">
          {hits === null && <p className="px-3 py-8 text-center text-[13px] text-muted">Type at least 2 characters to search titles and transcripts.</p>}
          {hits?.length === 0 && (
            <div className="px-3 py-10 text-center">
              <Search size={20} className="mx-auto mb-3 text-faint" />
              <p className="font-medium">No results found for &quot;{q}&quot;</p>
              <p className="mt-1 text-[13px] text-muted">Try a different keyword or check for spelling.</p>
            </div>
          )}
          {hits?.map((h, i) => (
            <button key={i} onClick={() => open(h)}
              className="flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-hover">
              {h.kind === "title" ? <Video size={15} className="mt-0.5 text-muted" /> : <FileText size={15} className="mt-0.5 text-muted" />}
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium">{h.meeting_title}</p>
                {h.kind === "transcript" && (
                  <p className="mt-0.5 line-clamp-2 text-xs text-muted">
                    <span className="text-link">{h.speaker} · {fmtTime(h.start_sec ?? 0)}</span>{" "}
                    <Highlight text={h.snippet} query={q} />
                  </p>
                )}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
