"use client";

import { FileAudio, FileText, FileUp, FileVideo, Loader2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { api } from "@/lib/api";

const AUDIO = [".mp3", ".m4a", ".wav", ".ogg"];
const VIDEO = [".mp4", ".webm", ".mov"];
const TRANSCRIPT = [".txt", ".vtt", ".srt", ".json"];
const LIMIT_MB = { media: 100, transcript: 2 };

function kindOf(file: File): "audio" | "video" | "transcript" | null {
  const name = file.name.toLowerCase();
  if (AUDIO.some((e) => name.endsWith(e))) return "audio";
  if (VIDEO.some((e) => name.endsWith(e))) return "video";
  if (TRANSCRIPT.some((e) => name.endsWith(e))) return "transcript";
  return null;
}

const sizeLabel = (bytes: number) => (bytes < 1e6 ? `${Math.max(1, Math.round(bytes / 1e3))} KB` : `${(bytes / 1e6).toFixed(1)} MB`);

/** Upload only: pick a recording (transcribed by Whisper) or a transcript file, then upload. */
export function UploadModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const kind = file ? kindOf(file) : null;

  function choose(f: File | undefined | null) {
    if (!f) return;
    const k = kindOf(f);
    const limit = k === "transcript" ? LIMIT_MB.transcript : LIMIT_MB.media;
    setFile(f);
    setError(!k ? "Unsupported file type. Use MP3, M4A, WAV, MP4, WEBM, or a TXT/VTT/SRT/JSON transcript."
      : f.size > limit * 1e6 ? `This file is ${sizeLabel(f.size)} — the limit is ${limit} MB.` : null);
  }

  async function upload() {
    if (!file || error) return;
    const form = new FormData();
    form.set("file", file);
    setBusy(true);
    try {
      const meeting = await api.createMeeting(form);
      toast.success(`“${meeting.title}” is ready`);
      onClose();
      router.push(`/meetings/${meeting.id}`);
    } catch (e) {
      toast.error((e as Error).message);
      setBusy(false);
    }
  }

  const Icon = kind === "audio" ? FileAudio : kind === "video" ? FileVideo : FileText;

  return (
    <Modal title="Upload a recording" onClose={busy ? () => {} : onClose}>
      {!file ? (
        <button type="button" onClick={() => input.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); choose(e.dataTransfer.files[0]); }}
          className="flex w-full flex-col items-center gap-2 rounded-lg border border-dashed border-line bg-card px-4 py-10 text-center hover:border-primary">
          <FileUp size={24} className="text-emerald-400" />
          <span className="text-[14px] font-medium">Drop a file here, or click to browse</span>
          <span className="text-xs text-muted">Audio or video: MP3, M4A, WAV, MP4, WEBM (max 100 MB)</span>
          <span className="text-xs text-muted">Transcripts: TXT, VTT, SRT, JSON (max 2 MB)</span>
        </button>
      ) : (
        <div className={`flex items-center gap-3 rounded-lg border p-3 ${error ? "border-red-500/60" : "border-line"} bg-card`}>
          <Icon size={22} className={error ? "text-red-400" : "text-primary"} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-medium">{file.name}</p>
            <p className="text-xs text-muted">{kind ? kind[0].toUpperCase() + kind.slice(1) : "Unknown type"} · {sizeLabel(file.size)}</p>
          </div>
          {!busy && (
            <button onClick={() => { setFile(null); setError(null); }} aria-label="Remove file" className="rounded p-1 text-faint hover:bg-hover hover:text-text">
              <X size={15} />
            </button>
          )}
        </div>
      )}
      <input ref={input} type="file" hidden accept={[...AUDIO, ...VIDEO, ...TRANSCRIPT].join(",")}
        onChange={(e) => { choose(e.target.files?.[0]); e.target.value = ""; }} />

      {error && <p role="alert" className="mt-2 text-xs text-red-400">{error}</p>}
      {file && !error && (
        <p className="mt-3 text-xs text-muted">
          {kind === "transcript"
            ? "Speakers and timestamps are read from the file, then Fireflies writes the notes."
            : "Whisper transcribes the recording (speakers start as “Speaker 1” — rename them in the transcript), then Fireflies writes the notes. You can edit the title and participants afterwards."}
        </p>
      )}

      <div className="mt-5 flex justify-end gap-2">
        <button onClick={onClose} disabled={busy} className="btn-ghost">Cancel</button>
        <button onClick={upload} disabled={!file || !!error || busy} className="btn-primary">
          {busy && <Loader2 size={14} className="animate-spin" />}
          {busy ? (kind === "transcript" ? "Writing notes…" : "Transcribing & writing notes…") : kind === "transcript" ? "Upload transcript" : "Upload & transcribe"}
        </button>
      </div>
    </Modal>
  );
}
