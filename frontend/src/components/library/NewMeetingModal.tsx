"use client";

import { FileUp, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { api } from "@/lib/api";

const MEDIA_EXT = [".mp3", ".m4a", ".wav", ".ogg", ".mp4", ".webm", ".mov"];
const TRANSCRIPT_EXT = [".txt", ".vtt", ".srt", ".json"];
const MAX_MEDIA_MB = 25;
const isMedia = (f: File) => MEDIA_EXT.some((e) => f.name.toLowerCase().endsWith(e));

const EXAMPLE = `[00:00] Alice: Let's review the launch checklist.
[00:12] Bob: Docs are done. I'll send the release notes by Friday.`;

/** Create a meeting from a recording (transcribed by the backend), a transcript file, or pasted text. */
export function NewMeetingModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const fileInput = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<"upload" | "paste">("upload");
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    if (mode === "upload") {
      if (!file) return toast.error("Choose a recording or transcript first");
      if (isMedia(file) && file.size > MAX_MEDIA_MB * 1e6) return toast.error(`Recordings must be ${MAX_MEDIA_MB} MB or smaller`);
      form.set("file", file);
    } else {
      if (!text.trim()) return toast.error("Paste a transcript first");
      form.set("transcript_text", text);
    }
    setBusy(true);
    try {
      const meeting = await api.createMeeting(form);
      toast.success(meeting.summary?.source === "ai" ? "Meeting created with AI notes" : "Meeting created");
      onClose();
      router.push(`/meetings/${meeting.id}`);
    } catch (err) {
      toast.error((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <Modal title="Add a meeting" onClose={busy ? () => {} : onClose} width="max-w-xl">
      <form onSubmit={submit} className="space-y-4">
        <div className="inline-flex rounded-md bg-card p-0.5 text-[13px]">
          {(["upload", "paste"] as const).map((m) => (
            <button key={m} type="button" onClick={() => setMode(m)}
              className={`rounded px-3 py-1 ${mode === m ? "bg-hover text-text" : "text-muted"}`}>
              {m === "upload" ? "Upload recording or file" : "Paste transcript"}
            </button>
          ))}
        </div>

        {mode === "upload" ? (
          <button type="button" onClick={() => fileInput.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); setFile(e.dataTransfer.files[0] ?? null); }}
            className="flex w-full flex-col items-center gap-2 rounded-lg border border-dashed border-line bg-card px-4 py-8 text-center hover:border-primary">
            <FileUp size={22} className="text-emerald-400" />
            <span className="text-[13px] font-medium">{file ? file.name : "Drop a recording or transcript here, or click to browse"}</span>
            <span className="text-xs text-muted">Recordings: MP3, M4A, WAV, MP4, WEBM (max {MAX_MEDIA_MB} MB) · Transcripts: TXT, VTT, SRT, JSON</span>
            <input ref={fileInput} type="file" hidden accept={[...MEDIA_EXT, ...TRANSCRIPT_EXT].join(",")}
              onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </button>
        ) : (
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={8}
            placeholder={EXAMPLE} className="input font-mono text-xs" />
        )}

        <div className="grid grid-cols-2 gap-3">
          <label className="col-span-2 text-xs text-muted">Title
            <input name="title" className="input mt-1" placeholder="Defaults to the file name" />
          </label>
          <label className="text-xs text-muted">Participants
            <input name="participants" className="input mt-1" placeholder="Comma separated" />
          </label>
          <label className="text-xs text-muted">Date
            <input name="date" type="datetime-local" className="input mt-1" />
          </label>
          <label className="col-span-2 text-xs text-muted">Tags
            <input name="tags" className="input mt-1" placeholder="e.g. sales, weekly" />
          </label>
        </div>
        <p className="text-xs text-faint">
          {file && mode === "upload" && isMedia(file)
            ? "The recording is transcribed with Whisper. Speakers start as “Speaker 1” — rename them from the transcript."
            : "Speakers found in the transcript are added as participants automatically."}
        </p>

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} disabled={busy} className="btn-ghost">Cancel</button>
          <button type="submit" disabled={busy} className="btn-primary">
            {busy && <Loader2 size={14} className="animate-spin" />}
            {busy ? (mode === "upload" && file && isMedia(file) ? "Transcribing & writing notes…" : "Generating notes…") : "Create meeting"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
