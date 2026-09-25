"use client";

import { Check, Globe, Link2, Mail } from "lucide-react";
import { useRef, useState } from "react";

import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { MeetingDetail } from "@/lib/api";
import { copyText } from "@/lib/clipboard";
import { fmtLongDate, fmtTime } from "@/lib/format";

/** Share dialog: the meeting link (optionally starting at the current moment) + placeholder invites. */
export function ShareModal({ meeting, currentTime, onClose }: {
  meeting: MeetingDetail;
  currentTime: number;
  onClose: () => void;
}) {
  const toast = useToast();
  const [atMoment, setAtMoment] = useState(false);
  const [copied, setCopied] = useState(false);
  const linkInput = useRef<HTMLInputElement>(null);
  const link = `${location.origin}/meetings/${meeting.id}${atMoment ? `?t=${Math.floor(currentTime)}` : ""}`;

  async function copy() {
    if (await copyText(link)) {
      setCopied(true);
      toast.success("Link copied");
      setTimeout(() => setCopied(false), 2000);
    } else {
      linkInput.current?.select(); // pre-select so ⌘C / Ctrl+C just works
      toast.error("Clipboard is blocked here — the link is selected, press ⌘C / Ctrl+C to copy");
    }
  }

  return (
    <Modal title="Share meeting" onClose={onClose}>
      <p className="text-[14px] font-medium">{meeting.title}</p>
      <p className="mb-4 text-xs text-muted">{meeting.organizer.name} · {fmtLongDate(meeting.date)}</p>

      <label className="text-xs text-muted">Invite teammates</label>
      <div className="mb-1 mt-1 flex gap-2">
        <div className="relative flex-1">
          <Mail size={14} className="absolute left-2.5 top-2.5 text-faint" />
          <input disabled placeholder="Name or email" className="input pl-8 opacity-60" />
        </div>
        <button disabled className="btn-primary">Invite</button>
      </div>
      <p className="mb-5 text-[11px] text-faint">Inviting teammates is coming soon (team accounts are out of scope).</p>

      <div className="flex items-center gap-3 rounded-lg border border-line bg-card p-3">
        <Globe size={16} className="shrink-0 text-primary" />
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-medium">Anyone with the link</p>
          <p className="text-xs text-muted">Can view the recording, transcript and notes</p>
        </div>
      </div>

      <div className="mt-3 flex gap-2">
        <input ref={linkInput} readOnly value={link} onFocus={(e) => e.currentTarget.select()} aria-label="Share link"
          className="input font-mono text-xs" />
        <button onClick={copy} className="btn-primary shrink-0">
          {copied ? <Check size={14} /> : <Link2 size={14} />} {copied ? "Copied" : "Copy link"}
        </button>
      </div>
      <label className="mt-3 flex items-center gap-2 text-xs text-muted">
        <input type="checkbox" checked={atMoment} onChange={(e) => setAtMoment(e.target.checked)} className="accent-[var(--primary)]" />
        Start at current moment ({fmtTime(currentTime)})
      </label>
    </Modal>
  );
}
