"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { api } from "@/lib/api";

const EXAMPLE = `[00:00] Alice: Let's review the launch checklist.
[00:12] Bob: Docs are done. I'll send the release notes by Friday.`;

/** Create a meeting by pasting a transcript and filling in its details. (File uploads use UploadModal.) */
export function CreateMeetingModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    if (!String(form.get("transcript_text") ?? "").trim()) return toast.error("Paste a transcript first");
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
    <Modal title="New meeting from a transcript" onClose={busy ? () => {} : onClose} width="max-w-xl">
      <form onSubmit={submit} className="space-y-3">
        <label className="block text-xs text-muted">Title
          <input name="title" required className="input mt-1" placeholder="e.g. Weekly sync" />
        </label>
        <label className="block text-xs text-muted">Transcript
          <textarea name="transcript_text" rows={8} placeholder={EXAMPLE} className="input mt-1 font-mono text-xs" />
        </label>
        <p className="text-[11px] text-faint">One line per turn: <code>[mm:ss] Name: text</code> (timestamps optional). Speakers become participants automatically.</p>
        <div className="grid grid-cols-2 gap-3">
          <label className="text-xs text-muted">Other participants
            <input name="participants" className="input mt-1" placeholder="Comma separated" />
          </label>
          <label className="text-xs text-muted">Date
            <input name="date" type="datetime-local" className="input mt-1" />
          </label>
        </div>
        <label className="block text-xs text-muted">Tags
          <input name="tags" className="input mt-1" placeholder="e.g. sales, weekly" />
        </label>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} disabled={busy} className="btn-ghost">Cancel</button>
          <button type="submit" disabled={busy} className="btn-primary">
            {busy && <Loader2 size={14} className="animate-spin" />}
            {busy ? "Writing notes…" : "Create meeting"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
