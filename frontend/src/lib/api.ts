const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export type Participant = { id: number; name: string; email: string | null };
export type Tag = { id: number; name: string };
export type User = { id: number; name: string; email: string };

export type MeetingListItem = {
  id: number;
  title: string;
  date: string;
  duration_sec: number;
  organizer: User;
  participants: Participant[];
  tags: Tag[];
  overview: string | null;
  media_url: string | null;
  media_type: "audio" | "video" | null;
};

export type Speaker = {
  id: number;
  name: string;
  participant_id: number | null;
  talk_sec: number;
  talk_pct: number;
  wpm: number;
};
export type Segment = { id: number; speaker_id: number; start_sec: number; end_sec: number; text: string };
export type Chapter = { id: number; title: string; summary: string; start_sec: number };
export type ActionItem = {
  id: number;
  meeting_id: number;
  text: string;
  assignee: Participant | null;
  is_completed: boolean;
  start_sec: number | null;
  created_at: string;
};
export type Task = ActionItem & { meeting_title: string };
export type Comment = { id: number; segment_id: number; body: string; created_at: string };
export type Soundbite = { id: number; title: string; start_sec: number; end_sec: number; created_at: string };
export type BookmarkKind = "important" | "action" | "positive" | "negative";
export type Bookmark = { id: number; kind: BookmarkKind; at_sec: number; created_at: string };
export type Notification = { kind: "notes_ready" | "tasks_due"; title: string; body: string; href: string; at: string };

export type MeetingDetail = MeetingListItem & {
  speakers: Speaker[];
  segments: Segment[];
  summary: { overview: string; source: "seed" | "ai" | "heuristic"; generated_at: string } | null;
  chapters: Chapter[];
  action_items: ActionItem[];
  comments: Comment[];
  soundbites: Soundbite[];
  bookmarks: Bookmark[];
};

export type SearchHit = {
  meeting_id: number;
  meeting_title: string;
  meeting_date: string;
  kind: "title" | "transcript";
  snippet: string;
  start_sec: number | null;
  speaker: string | null;
};

export type MeetingFilters = {
  q?: string;
  participant_id?: number[];
  tag?: string;
  date_from?: string;
  date_to?: string;
  min_duration?: number;
  max_duration?: number;
  sort?: "recent" | "oldest";
};

/** Recordings are served by the backend, so make its relative /media URL absolute. */
export const mediaSrc = (url: string) => `${BASE}${url}`;

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}/api${path}`, init);
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const detail = body?.detail;
    const message = typeof detail === "string" ? detail : Array.isArray(detail) ? detail[0]?.msg : res.statusText;
    throw new ApiError(res.status, message || "Request failed");
  }
  return res.status === 204 ? (undefined as T) : res.json();
}

const json = (method: string, body: unknown): RequestInit => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

function query(params: Record<string, unknown>) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (Array.isArray(v)) v.forEach((x) => qs.append(k, String(x)));
    else if (v !== undefined && v !== null && v !== "") qs.set(k, String(v));
  }
  const s = qs.toString();
  return s ? `?${s}` : "";
}

export const api = {
  me: () => request<User>("/me"),
  meetings: (f: MeetingFilters = {}) =>
    request<{ meetings: MeetingListItem[]; total: number }>(`/meetings${query(f)}`),
  meeting: (id: number) => request<MeetingDetail>(`/meetings/${id}`),
  createMeeting: (form: FormData) => request<MeetingDetail>("/meetings", { method: "POST", body: form }),
  updateMeeting: (id: number, body: { title?: string; participants?: string[]; tags?: string[]; date?: string }) =>
    request<MeetingDetail>(`/meetings/${id}`, json("PATCH", body)),
  deleteMeeting: (id: number) => request<void>(`/meetings/${id}`, { method: "DELETE" }),
  regenerateNotes: (id: number) => request<MeetingDetail>(`/meetings/${id}/notes`, { method: "POST" }),
  renameSpeaker: (id: number, speakerId: number, name: string) =>
    request<MeetingDetail>(`/meetings/${id}/speakers/${speakerId}`, json("PATCH", { name })),
  ask: (id: number, question: string, history: { role: string; content: string }[]) =>
    request<{ answer: string; source: string }>(`/meetings/${id}/ask`, json("POST", { question, history })),

  tasks: (status: "all" | "open" | "done" = "all") => request<Task[]>(`/action-items?status=${status}`),
  addActionItem: (meetingId: number, body: { text: string; assignee_id?: number | null }) =>
    request<ActionItem>(`/meetings/${meetingId}/action-items`, json("POST", body)),
  updateActionItem: (id: number, body: Partial<{ text: string; assignee_id: number | null; is_completed: boolean }>) =>
    request<ActionItem>(`/action-items/${id}`, json("PATCH", body)),
  deleteActionItem: (id: number) => request<void>(`/action-items/${id}`, { method: "DELETE" }),

  addComment: (meetingId: number, segment_id: number, body: string) =>
    request<Comment>(`/meetings/${meetingId}/comments`, json("POST", { segment_id, body })),
  deleteComment: (id: number) => request<void>(`/comments/${id}`, { method: "DELETE" }),
  addSoundbite: (meetingId: number, body: { title: string; start_sec: number; end_sec: number }) =>
    request<Soundbite>(`/meetings/${meetingId}/soundbites`, json("POST", body)),
  deleteSoundbite: (id: number) => request<void>(`/soundbites/${id}`, { method: "DELETE" }),
  addBookmark: (meetingId: number, kind: BookmarkKind, at_sec: number) =>
    request<Bookmark>(`/meetings/${meetingId}/bookmarks`, json("POST", { kind, at_sec })),
  deleteBookmark: (id: number) => request<void>(`/bookmarks/${id}`, { method: "DELETE" }),
  editSegment: (id: number, text: string) => request<Segment>(`/segments/${id}`, json("PATCH", { text })),

  askWorkspace: (question: string, history: { role: string; content: string }[], tag?: string) =>
    request<{ answer: string; source: string }>("/ask", json("POST", { question, history, tag })),
  notifications: () => request<Notification[]>("/notifications"),

  search: (q: string) => request<SearchHit[]>(`/search?q=${encodeURIComponent(q)}`),
  participants: () => request<Participant[]>("/participants"),
  tags: () => request<Tag[]>("/tags"),
};
