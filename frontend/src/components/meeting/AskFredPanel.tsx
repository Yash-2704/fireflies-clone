"use client";

import { ArrowUp, Copy, Loader2, Sparkles, ThumbsDown, ThumbsUp } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { Player } from "@/components/meeting/usePlayer";
import { useToast } from "@/components/ui/Toast";
import { copyAndNotify } from "@/lib/clipboard";
import { api, MeetingDetail } from "@/lib/api";
import { toSeconds } from "@/lib/format";

type Message = { role: "user" | "assistant"; content: string; rating?: "up" | "down" };
type AskFn = (question: string, history: { role: string; content: string }[]) => Promise<{ answer: string }>;

// Models cite moments as [02:46], 【02:46】 or ranges [02:18-02:30], and meetings as [[Title]].
const T = "(?:\\d{1,2}:)?\\d{1,2}:\\d{2}";
const TOKEN = new RegExp(`\\[\\[([^\\]]+)\\]\\]|[[【](${T})(?:\\s*[-–‑]\\s*${T})?[\\]】]`, "g");

function Answer({ text, onSeek, meetingIds }: {
  text: string;
  onSeek?: (sec: number) => void;
  meetingIds?: Map<string, number>;
}) {
  return (
    <>
      {text.split("\n").map((line, i) => {
        const bullet = /^\s*[-*•]\s+/.test(line);
        const body = line.replace(/^\s*[-*•]\s+/, "").replace(/\*{1,2}([^*]+)\*{1,2}/g, "$1");
        const parts: React.ReactNode[] = [];
        let last = 0;
        for (const m of body.matchAll(TOKEN)) {
          parts.push(body.slice(last, m.index));
          const [title, stamp] = [m[1], m[2]];
          const id = title ? meetingIds?.get(title.toLowerCase()) : undefined;
          parts.push(
            title ? (id ? <Link key={m.index} href={`/meetings/${id}`} className="text-link hover:underline">{title}</Link> : title)
            : onSeek ? <button key={m.index} onClick={() => onSeek(toSeconds(stamp))} className="text-link hover:underline">({stamp})</button>
            : `(${stamp})`,
          );
          last = m.index + m[0].length;
        }
        parts.push(body.slice(last));
        return (
          <p key={i} className={`${bullet ? "relative pl-4 before:absolute before:left-1 before:content-['•']" : ""} min-h-[0.5em]`}>{parts}</p>
        );
      })}
    </>
  );
}

/** Chat UI shared by per-meeting AskFred and workspace-wide AskFred. */
export function AskFredChat({ ask, greeting, subtitle, suggestions, quickChips, onSeek, meetingIds, placeholder }: {
  ask: AskFn;
  greeting: string;
  subtitle: string;
  suggestions: string[];
  quickChips: string[];
  onSeek?: (sec: number) => void;
  meetingIds?: Map<string, number>;
  placeholder: string;
}) {
  const toast = useToast();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => { bottom.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }); }, [messages, busy]);

  async function send(question: string) {
    if (!question.trim() || busy) return;
    const history = messages.map(({ role, content }) => ({ role, content }));
    setMessages([...messages, { role: "user", content: question }]);
    setInput("");
    setBusy(true);
    try {
      const { answer } = await ask(question, history);
      setMessages((m) => [...m, { role: "assistant", content: answer }]);
    } catch (e) {
      setMessages((m) => [...m, { role: "assistant", content: `Sorry, something went wrong: ${(e as Error).message}` }]);
    } finally {
      setBusy(false);
    }
  }

  const rate = (i: number, rating: "up" | "down") =>
    setMessages((ms) => ms.map((m, j) => (j === i ? { ...m, rating: m.rating === rating ? undefined : rating } : m)));

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {messages.length === 0 ? (
          <div className="rounded-xl bg-gradient-to-b from-primary-soft to-transparent px-4 py-8">
            <Sparkles size={22} className="mb-4 text-emerald-300" />
            <p className="text-[17px] font-medium">{greeting}</p>
            <p className="text-[17px] text-muted">{subtitle}</p>
            <div className="mt-6 space-y-2">
              {suggestions.map((s) => (
                <button key={s} onClick={() => send(s)}
                  className="block w-full rounded-lg bg-card px-3 py-2.5 text-left text-[13px] hover:bg-hover">{s}</button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4 text-[13.5px] leading-relaxed">
            {messages.map((m, i) => m.role === "user" ? (
              <div key={i} className="ml-8 rounded-lg bg-primary-soft px-3 py-2">{m.content}</div>
            ) : (
              <div key={i}>
                <div className="space-y-1"><Answer text={m.content} onSeek={onSeek} meetingIds={meetingIds} /></div>
                <div className="mt-1.5 flex gap-1 text-faint">
                  <button onClick={() => copyAndNotify(toast, m.content, "Answer copied")}
                    aria-label="Copy answer" className="rounded p-1 hover:bg-hover hover:text-text"><Copy size={13} /></button>
                  <button onClick={() => rate(i, "up")} aria-label="Helpful" aria-pressed={m.rating === "up"}
                    className={`rounded p-1 hover:bg-hover ${m.rating === "up" ? "text-emerald-400" : "hover:text-text"}`}><ThumbsUp size={13} /></button>
                  <button onClick={() => rate(i, "down")} aria-label="Not helpful" aria-pressed={m.rating === "down"}
                    className={`rounded p-1 hover:bg-hover ${m.rating === "down" ? "text-red-400" : "hover:text-text"}`}><ThumbsDown size={13} /></button>
                </div>
              </div>
            ))}
            {busy && <p className="flex items-center gap-2 text-muted"><Loader2 size={14} className="animate-spin" /> Fred is thinking…</p>}
            <div ref={bottom} />
          </div>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5 px-3 pt-2">
        {quickChips.map((c) => (
          <button key={c} onClick={() => send(c)} disabled={busy} className="chip hover:border-primary hover:text-text">
            <Sparkles size={11} className="text-emerald-300" /> {c}
          </button>
        ))}
      </div>
      <form onSubmit={(e) => { e.preventDefault(); send(input); }} className="m-3 rounded-xl border border-line bg-card p-2">
        <textarea value={input} onChange={(e) => setInput(e.target.value)} rows={2} placeholder={placeholder}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }}
          className="w-full resize-none bg-transparent px-1 text-[13px] outline-none placeholder:text-faint" />
        <div className="flex justify-end">
          <button disabled={busy || !input.trim()} aria-label="Send" className="rounded-md bg-primary p-1.5 text-white disabled:opacity-40">
            <ArrowUp size={14} />
          </button>
        </div>
      </form>
    </div>
  );
}

export function AskFredPanel({ meeting, player }: { meeting: MeetingDetail; player: Player }) {
  return (
    <AskFredChat
      ask={(q, h) => api.ask(meeting.id, q, h)}
      greeting={`Hi ${meeting.organizer.name.split(" ")[0]}!`}
      subtitle="Ask anything about this meeting"
      suggestions={["What were the key decisions?", "What are the open questions or risks?", "Summarize this meeting in 3 bullets"]}
      quickChips={["Attendee contributions", "Todos"]}
      onSeek={player.seek}
      placeholder="Ask anything about this meeting"
    />
  );
}
