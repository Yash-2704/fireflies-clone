"use client";

import { ArrowUp, Loader2, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Player } from "@/components/meeting/usePlayer";
import { api, MeetingDetail } from "@/lib/api";
import { toSeconds } from "@/lib/format";

type Message = { role: "user" | "assistant"; content: string };

const SUGGESTIONS = [
  "What were the key decisions?",
  "List the action items and owners",
  "What are the open questions or risks?",
];

// Models cite moments as [02:46], 【02:46】 or ranges [02:18-02:30]; link to the (first) time.
const T = "(?:\\d{1,2}:)?\\d{1,2}:\\d{2}";
const STAMP = new RegExp(`[[【](${T})(?:\\s*[-–‑]\\s*${T})?[\\]】]`, "g");

function Answer({ text, onSeek }: { text: string; onSeek: (sec: number) => void }) {
  return (
    <>
      {text.split("\n").map((line, i) => {
        const bullet = /^\s*[-*•]\s+/.test(line);
        const parts = line.replace(/^\s*[-*•]\s+/, "").replace(/\*{1,2}([^*]+)\*{1,2}/g, "$1").split(STAMP);
        return (
          <p key={i} className={`${bullet ? "relative pl-4 before:absolute before:left-1 before:content-['•']" : ""} min-h-[0.5em]`}>
            {parts.map((p, j) => j % 2
              ? <button key={j} onClick={() => onSeek(toSeconds(p))} className="text-link hover:underline">({p})</button>
              : p)}
          </p>
        );
      })}
    </>
  );
}

export function AskFredPanel({ meeting, player }: { meeting: MeetingDetail; player: Player }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => { bottom.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }); }, [messages, busy]);

  async function ask(question: string) {
    if (!question.trim() || busy) return;
    const history = messages;
    setMessages([...history, { role: "user", content: question }]);
    setInput("");
    setBusy(true);
    try {
      const { answer } = await api.ask(meeting.id, question, history);
      setMessages((m) => [...m, { role: "assistant", content: answer }]);
    } catch (e) {
      setMessages((m) => [...m, { role: "assistant", content: `Sorry, something went wrong: ${(e as Error).message}` }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {messages.length === 0 ? (
          <div className="rounded-xl bg-gradient-to-b from-primary-soft to-transparent px-4 py-8">
            <Sparkles size={22} className="mb-4 text-emerald-300" />
            <p className="text-[17px] font-medium">Hi {meeting.organizer.name.split(" ")[0]}!</p>
            <p className="text-[17px] text-muted">Ask anything about this meeting</p>
            <div className="mt-6 space-y-2">
              {SUGGESTIONS.map((s) => (
                <button key={s} onClick={() => ask(s)}
                  className="block w-full rounded-lg bg-card px-3 py-2.5 text-left text-[13px] hover:bg-hover">{s}</button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4 text-[13.5px] leading-relaxed">
            {messages.map((m, i) => m.role === "user" ? (
              <div key={i} className="ml-8 rounded-lg bg-primary-soft px-3 py-2">{m.content}</div>
            ) : (
              <div key={i} className="space-y-1"><Answer text={m.content} onSeek={player.seek} /></div>
            ))}
            {busy && <p className="flex items-center gap-2 text-muted"><Loader2 size={14} className="animate-spin" /> Fred is thinking…</p>}
            <div ref={bottom} />
          </div>
        )}
      </div>
      <form onSubmit={(e) => { e.preventDefault(); ask(input); }} className="m-3 rounded-xl border border-line bg-card p-2">
        <textarea value={input} onChange={(e) => setInput(e.target.value)} rows={2} placeholder="Ask anything about this meeting"
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); ask(input); } }}
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
