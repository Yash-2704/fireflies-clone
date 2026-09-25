"use client";

import { CheckSquare, Star, ThumbsDown, ThumbsUp } from "lucide-react";

import { useToast } from "@/components/ui/Toast";
import { api, BookmarkKind, MeetingDetail } from "@/lib/api";
import { fmtTime } from "@/lib/format";

export const BOOKMARK_KINDS: Record<BookmarkKind, { label: string; icon: typeof Star; color: string }> = {
  important: { label: "Important", icon: Star, color: "#e0b43a" },
  action: { label: "Action item", icon: CheckSquare, color: "#8e9bff" },
  positive: { label: "Positive", icon: ThumbsUp, color: "#4fbf8f" },
  negative: { label: "Negative", icon: ThumbsDown, color: "#e0677b" },
};

export type Annotations = ReturnType<typeof useAnnotations>;

/** Comment / soundbite / bookmark / transcript-edit mutations that keep the meeting state in sync. */
export function useAnnotations(meeting: MeetingDetail, setMeeting: (m: MeetingDetail) => void) {
  const toast = useToast();

  async function run(fn: () => Promise<Partial<MeetingDetail>>, ok: string) {
    try {
      setMeeting({ ...meeting, ...(await fn()) });
      toast.success(ok);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return {
    addComment: (segmentId: number, body: string) =>
      run(async () => ({ comments: [...meeting.comments, await api.addComment(meeting.id, segmentId, body)] }), "Comment added"),
    deleteComment: (id: number) =>
      run(async () => (await api.deleteComment(id), { comments: meeting.comments.filter((c) => c.id !== id) }), "Comment deleted"),
    addSoundbite: (title: string, start: number, end: number) =>
      run(async () => ({
        soundbites: [...meeting.soundbites, await api.addSoundbite(meeting.id, { title, start_sec: start, end_sec: end })]
          .sort((a, b) => a.start_sec - b.start_sec),
      }), `Soundbite created (${fmtTime(start)}–${fmtTime(end)})`),
    deleteSoundbite: (id: number) =>
      run(async () => (await api.deleteSoundbite(id), { soundbites: meeting.soundbites.filter((s) => s.id !== id) }), "Soundbite deleted"),
    addBookmark: (kind: BookmarkKind, at: number) =>
      run(async () => ({
        bookmarks: [...meeting.bookmarks, await api.addBookmark(meeting.id, kind, at)].sort((a, b) => a.at_sec - b.at_sec),
      }), `${BOOKMARK_KINDS[kind].label} bookmark at ${fmtTime(at)}`),
    deleteBookmark: (id: number) =>
      run(async () => (await api.deleteBookmark(id), { bookmarks: meeting.bookmarks.filter((b) => b.id !== id) }), "Bookmark removed"),
    editSegment: (id: number, text: string) =>
      run(async () => {
        const updated = await api.editSegment(id, text);
        return { segments: meeting.segments.map((s) => (s.id === id ? updated : s)) };
      }, "Transcript updated"),
  };
}
