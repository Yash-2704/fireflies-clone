import { MeetingDetail } from "@/lib/api";
import { fmtLongDate, fmtTime } from "@/lib/format";

function download(filename: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = Object.assign(document.createElement("a"), { href: url, download: filename });
  a.click();
  URL.revokeObjectURL(url);
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

function transcriptLines(m: MeetingDetail) {
  const names = new Map(m.speakers.map((s) => [s.id, s.name]));
  return m.segments.map((s) => `[${fmtTime(s.start_sec)}] ${names.get(s.speaker_id)}: ${s.text}`);
}

export function exportTranscriptTxt(m: MeetingDetail) {
  // Same format the importer accepts, so an export can be re-uploaded.
  download(`${slug(m.title)}-transcript.txt`, transcriptLines(m).join("\n"), "text/plain");
}

export function exportNotesMarkdown(m: MeetingDetail) {
  const md = [
    `# ${m.title}`,
    `${fmtLongDate(m.date)} · Participants: ${m.participants.map((p) => p.name).join(", ")}`,
    "## Overview", m.summary?.overview ?? "_No summary_",
    "## Outline", ...m.chapters.map((c) => `- **${c.title}** (${fmtTime(c.start_sec)}) — ${c.summary}`),
    "## Action items",
    ...m.action_items.map((a) => `- [${a.is_completed ? "x" : " "}] ${a.text}${a.assignee ? ` — ${a.assignee.name}` : ""}`),
    "## Transcript", ...transcriptLines(m).map((l) => `${l}  `),
  ].join("\n\n");
  download(`${slug(m.title)}-notes.md`, md, "text/markdown");
}
