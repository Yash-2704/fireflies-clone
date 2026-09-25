"use client";

import { useState } from "react";

import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { api, MeetingDetail, MeetingListItem } from "@/lib/api";

const split = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean);

/** Edit title, participants and tags ("Meeting info" in Fireflies). */
export function EditMeetingModal({ meeting, onClose, onSaved }: {
  meeting: MeetingListItem;
  onClose: () => void;
  onSaved: (m: MeetingDetail) => void;
}) {
  const toast = useToast();
  const [title, setTitle] = useState(meeting.title);
  const [participants, setParticipants] = useState(meeting.participants.map((p) => p.name).join(", "));
  const [tags, setTags] = useState(meeting.tags.map((t) => t.name).join(", "));
  const [busy, setBusy] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const updated = await api.updateMeeting(meeting.id, {
        title: title.trim(), participants: split(participants), tags: split(tags),
      });
      toast.success("Meeting updated");
      onSaved(updated);
      onClose();
    } catch (err) {
      toast.error((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <Modal title="Meeting info" onClose={onClose}>
      <form onSubmit={save} className="space-y-3">
        <label className="block text-xs text-muted">Title
          <input required value={title} onChange={(e) => setTitle(e.target.value)} className="input mt-1" />
        </label>
        <label className="block text-xs text-muted">Participants (comma separated)
          <input value={participants} onChange={(e) => setParticipants(e.target.value)} className="input mt-1" />
        </label>
        <label className="block text-xs text-muted">Tags (comma separated)
          <input value={tags} onChange={(e) => setTags(e.target.value)} className="input mt-1" />
        </label>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="btn-ghost">Cancel</button>
          <button disabled={busy || !title.trim()} className="btn-primary">Save</button>
        </div>
      </form>
    </Modal>
  );
}
