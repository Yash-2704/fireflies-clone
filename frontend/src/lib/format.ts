export function fmtTime(sec: number) {
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const pad = (n: number) => String(n).padStart(2, "0");
  return h ? `${h}:${pad(m)}:${pad(s % 60)}` : `${pad(m)}:${pad(s % 60)}`;
}

export function fmtDuration(sec: number) {
  const m = Math.round(sec / 60);
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)}h ${m % 60}m`;
}

/** "Sep 25 · 12:29 PM" like the Fireflies library rows. */
export function fmtDateTime(iso: string) {
  const d = new Date(iso);
  const date = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return `${date} · ${time}`;
}

export function fmtLongDate(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    month: "short", day: "2-digit", year: "numeric", hour: "numeric", minute: "2-digit",
  });
}

/** Group heading for the library list: Today / Yesterday / This week / Month Year. */
export function dayGroup(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const day = new Date(d);
  day.setHours(0, 0, 0, 0);
  const diff = Math.round((today.getTime() - day.getTime()) / 86_400_000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  if (diff < 7) return d.toLocaleDateString("en-US", { weekday: "long" });
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

export const initials = (name: string) =>
  name.split(/\s+/).map((p) => p[0]).join("").slice(0, 2).toUpperCase();

// Muted palette so speaker colours stay readable on dark panels.
const COLORS = ["#4f9d7e", "#7c6cf0", "#d4854a", "#4a8fd4", "#c75d8f", "#b5a33a", "#5aa9b5", "#9a6fd0"];

export function colorFor(key: string) {
  let h = 0;
  for (const c of key) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return COLORS[h % COLORS.length];
}

/** Parse "01:05" / "1:02:03" into seconds. */
export function toSeconds(stamp: string) {
  return stamp.split(":").reduce((acc, p) => acc * 60 + Number(p), 0);
}
