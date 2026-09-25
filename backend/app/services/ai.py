"""Meeting notes + Q&A via Groq (openai/gpt-oss-120b), with an offline heuristic fallback.

The fallback keeps the app fully usable without keys or when Groq is rate-limited;
results record their `source` so the UI can say whether notes came from the LLM.
"""

import json
import logging
import os
import re
from itertools import cycle

import httpx

log = logging.getLogger(__name__)

GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"
GROQ_STT_URL = "https://api.groq.com/openai/v1/audio/transcriptions"
STT_MODEL = "whisper-large-v3"
MODEL = os.getenv("GROQ_MODEL", "openai/gpt-oss-120b")
_KEYS = [k.strip() for k in os.getenv("GROQ_KEYS", "").split(",") if k.strip()]
_key_cycle = cycle(_KEYS) if _KEYS else None
# ponytail: free-tier Groq allows ~8k tokens/min per key, so long transcripts are
# truncated. Chunk + merge summaries if meetings over ~1h matter.
MAX_TRANSCRIPT_CHARS = 18_000


def fmt_time(sec: float) -> str:
    sec = int(sec)
    h, m, s = sec // 3600, sec % 3600 // 60, sec % 60
    return f"{h}:{m:02d}:{s:02d}" if h else f"{m:02d}:{s:02d}"


def transcript_as_text(lines: list[tuple[float, str, str]]) -> str:
    """lines = [(start_sec, speaker, text)] -> "[mm:ss] Speaker: text" block, truncated."""
    out = "\n".join(f"[{fmt_time(t)}] {sp}: {tx}" for t, sp, tx in lines)
    return out[:MAX_TRANSCRIPT_CHARS]


def _chat(messages: list[dict], json_mode: bool = False, effort: str = "low") -> str | None:
    """Call Groq, rotating through keys on rate limits / errors. None if all fail."""
    if not _key_cycle:
        return None
    body = {"model": MODEL, "messages": messages, "temperature": 0.3, "reasoning_effort": effort}
    if json_mode:
        body["response_format"] = {"type": "json_object"}
    for _ in range(len(_KEYS)):
        key = next(_key_cycle)
        try:
            r = httpx.post(GROQ_URL, json=body, timeout=60,
                           headers={"Authorization": f"Bearer {key}"})
            if r.status_code == 200:
                return r.json()["choices"][0]["message"]["content"]
            log.warning("Groq %s: %s", r.status_code, r.text[:200])
        except httpx.HTTPError as e:
            log.warning("Groq request failed: %s", e)
    return None


class TranscriptionError(RuntimeError):
    pass


def transcribe(filename: str, data: bytes) -> tuple[list[dict], float]:
    """Speech-to-text via Groq Whisper. Returns ([{start, end, text}], duration_sec).
    Whisper has no speaker diarization, so callers label everything "Speaker 1"."""
    if not _KEYS:
        raise TranscriptionError("Transcription needs a Groq API key (GROQ_KEYS)")
    last_error = "unknown error"
    for _ in range(len(_KEYS)):
        try:
            r = httpx.post(
                GROQ_STT_URL, timeout=300,
                headers={"Authorization": f"Bearer {next(_key_cycle)}"},
                files={"file": (filename, data)},
                data={"model": STT_MODEL, "response_format": "verbose_json"},
            )
        except httpx.HTTPError as e:
            last_error = str(e)
            continue
        if r.status_code == 200:
            body = r.json()
            segments = [
                {"start": s["start"], "end": s["end"], "text": s["text"].strip()}
                for s in body.get("segments", []) if s["text"].strip()
            ]
            if not segments:
                raise TranscriptionError("No speech was detected in this recording")
            return segments, float(body.get("duration") or segments[-1]["end"])
        last_error = r.json().get("error", {}).get("message", r.text[:200]) if r.headers.get(
            "content-type", "").startswith("application/json") else r.text[:200]
        if r.status_code not in (429, 500, 502, 503):
            break  # bad file etc. — retrying with another key won't help
    raise TranscriptionError(f"Transcription failed: {last_error}")


NOTES_PROMPT = """You write meeting notes like Fireflies.ai. Given a transcript where each line is
"[mm:ss] Speaker: text", return JSON with exactly these keys:
{
  "overview": "3-5 sentence summary of the meeting's purpose, key discussion and outcomes",
  "chapters": [{"title": "short topic title", "summary": "1-2 sentences", "start": "mm:ss of the line where this topic starts"}],
  "action_items": [{"text": "imperative task", "assignee": "speaker name or null", "start": "mm:ss where it was said"}]
}
Use 3-6 chapters in chronological order. Only include action items that were actually agreed or
promised. Use the exact speaker names from the transcript. Timestamps must be copied from real lines."""


def generate_notes(title: str, lines: list[tuple[float, str, str]]) -> tuple[dict, str]:
    """Returns (notes, source) where source is "ai" or "heuristic"."""
    raw = _chat([
        {"role": "system", "content": NOTES_PROMPT},
        {"role": "user", "content": f"Meeting title: {title}\n\nTranscript:\n{transcript_as_text(lines)}"},
    ], json_mode=True, effort="medium")
    if raw:
        try:
            return normalize_notes(json.loads(raw)), "ai"
        except (json.JSONDecodeError, TypeError, ValueError) as e:
            log.warning("Unusable LLM notes, falling back: %s", e)
    return heuristic_notes(lines), "heuristic"


def _parse_stamp(value) -> float:
    if isinstance(value, (int, float)):
        return float(value)
    parts = [float(p) for p in re.findall(r"\d+(?:\.\d+)?", str(value))] or [0]
    total = 0.0
    for p in parts[-3:]:
        total = total * 60 + p
    return total


def normalize_notes(data: dict) -> dict:
    return {
        "overview": str(data["overview"]).strip(),
        "chapters": [
            {"title": str(c["title"]).strip(), "summary": str(c.get("summary") or "").strip(),
             "start_sec": _parse_stamp(c.get("start", 0))}
            for c in data.get("chapters") or [] if c.get("title")
        ],
        "action_items": [
            {"text": str(a["text"]).strip(), "assignee": (a.get("assignee") or None),
             "start_sec": _parse_stamp(a.get("start", 0))}
            for a in data.get("action_items") or [] if a.get("text")
        ],
    }


_TASK_HINT = re.compile(
    r"\b(i'll|i will|we'll|we will|will send|will share|need to|action item|follow up|by (monday|tuesday|wednesday|thursday|friday|tomorrow|next week|eod))\b",
    re.I,
)


def heuristic_notes(lines: list[tuple[float, str, str]]) -> dict:
    """Offline notes: overview from the longest early lines, evenly split chapters, and
    action items from commitment phrases ("I'll…", "need to…")."""
    if not lines:
        return {"overview": "", "chapters": [], "action_items": []}
    substantive = sorted(lines[: max(8, len(lines) // 3)], key=lambda l: -len(l[2]))[:3]
    overview = " ".join(t for _, _, t in sorted(substantive))
    n_chapters = min(4, max(1, len(lines) // 6))
    size = -(-len(lines) // n_chapters)
    chapters = []
    for i in range(0, len(lines), size):
        chunk = lines[i:i + size]
        first = max(chunk, key=lambda l: len(l[2]))[2]
        chapters.append({
            "title": " ".join(first.split()[:6]).rstrip(".,") + "…",
            "summary": first, "start_sec": chunk[0][0],
        })
    actions = [
        {"text": t, "assignee": sp, "start_sec": s}
        for s, sp, t in lines if _TASK_HINT.search(t)
    ][:8]
    return {"overview": overview, "chapters": chapters, "action_items": actions}


ASK_PROMPT = """You are AskFred, the Fireflies.ai meeting assistant. Answer the user's question using
only the meeting context below. Be concise; use short bullet points when listing things. When you
reference a specific moment, cite a single timestamp as [mm:ss] (no ranges). Use plain text with
"- " bullets only; no other markdown. If the answer isn't in the meeting, say so plainly."""


def answer_question(context: str, question: str, history: list[dict]) -> tuple[str, str]:
    messages = [{"role": "system", "content": f"{ASK_PROMPT}\n\n{context}"}]
    messages += [{"role": m["role"], "content": m["content"]} for m in history[-6:]]
    messages.append({"role": "user", "content": question})
    answer = _chat(messages)
    if answer:
        return answer.strip(), "ai"
    return _keyword_answer(context, question), "heuristic"


def _keyword_answer(context: str, question: str) -> str:
    words = {w for w in re.findall(r"[a-z]{4,}", question.lower())}
    hits = [
        line for line in context.splitlines()
        if line.startswith("[") and words & set(re.findall(r"[a-z]{4,}", line.lower()))
    ]
    if not hits:
        return "I couldn't find anything about that in this meeting. (AI is offline — showing keyword matches only.)"
    return "AI is offline, but these moments look relevant:\n" + "\n".join(f"- {h}" for h in hits[:5])
