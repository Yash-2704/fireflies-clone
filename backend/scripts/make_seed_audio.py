"""One-time generator: speak every seed transcript with Groq Orpheus TTS (a consistent voice per
speaker), join the clips into one MP3 per meeting, and rewrite the timestamps in
app/seed_data.py so transcript lines and note timestamps match the real audio.

    python -m scripts.make_seed_audio        (from backend/, needs GROQ_KEYS and ffmpeg)

Clips are cached in scripts/.tts_cache, so a rate-limited run can simply be re-run.
"""

import hashlib
import re
import subprocess
import sys
import time
import wave
from itertools import cycle
from pathlib import Path

import httpx

from app.seed_data import MEETINGS
from app.services.ai import _KEYS
from app.services.transcript_parser import parse_transcript

ROOT = Path(__file__).resolve().parent.parent
SEED_FILE = ROOT / "app" / "seed_data.py"
OUT_DIR = ROOT / "app" / "seed_media"
CACHE = Path(__file__).resolve().parent / ".tts_cache"
TTS_URL = "https://api.groq.com/openai/v1/audio/speech"
MODEL = "canopylabs/orpheus-v1-english"
PAUSE = 0.45  # seconds of silence between turns
MAX_CHARS = 190  # keep each TTS request short; long turns are split by sentence

FEMALE = {"Priya Sharma", "Maria Lopez", "Olivia Chen", "Sofia Rossi", "Hannah Wright"}
VOICES = {"f": ["autumn", "diana", "hannah"], "m": ["troy", "austin", "daniel"]}

keys = cycle(_KEYS)


def slug(title: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-")[:48]


def chunks(text: str) -> list[str]:
    out, cur = [], ""
    for sentence in re.split(r"(?<=[.?!])\s+", text):
        if cur and len(cur) + len(sentence) > MAX_CHARS:
            out.append(cur)
            cur = sentence
        else:
            cur = f"{cur} {sentence}".strip()
    return out + [cur] if cur else out


def tts(text: str, voice: str) -> Path:
    path = CACHE / f"{hashlib.sha1(f'{voice}|{text}'.encode()).hexdigest()}.wav"
    if path.exists():
        return path
    for attempt in range(60):
        r = httpx.post(TTS_URL, timeout=120, headers={"Authorization": f"Bearer {next(keys)}"},
                       json={"model": MODEL, "voice": voice, "input": text, "response_format": "wav"})
        if r.status_code == 200:
            path.write_bytes(r.content)
            return path
        if "model_terms_required" in r.text:
            continue  # this key's Groq org hasn't accepted Orpheus terms; try the next key
        if r.status_code == 429 and "per day" in r.text:
            sys.exit(f"Daily Orpheus quota used up for this Groq org: {r.json()['error']['message'][:200]}\n"
                     "Re-run later (finished clips are cached) or add a key from another org.")
        if r.status_code == 429:
            # Free tier: 1200 TTS tokens/min per key. Wait as long as Groq asks, then retry.
            time.sleep(float(r.headers.get("retry-after", 10)))
            continue
        sys.exit(f"TTS failed ({r.status_code}): {r.text[:300]}")
    sys.exit("TTS kept hitting rate limits (free tier: 100 requests/day per key); "
             "re-run later — finished clips are cached.")


def wav_seconds(path: Path) -> float:
    # Groq streams WAV with a placeholder frame count in the header, so derive the length
    # from the PCM payload size instead (standard 44-byte header).
    with wave.open(str(path)) as w:
        bytes_per_sec = w.getframerate() * w.getnchannels() * w.getsampwidth()
    return (path.stat().st_size - 44) / bytes_per_sec


def fmt(sec: float) -> str:
    s = int(round(sec))
    return f"{s // 60:02d}:{s % 60:02d}"


def build_meeting(data: dict) -> tuple[str, dict[str, str]]:
    """Returns (mp3 filename, {old "mm:ss" -> new "mm:ss"})."""
    segments = parse_transcript(data["transcript"])
    pools = {g: iter(v) for g, v in VOICES.items()}
    voice_of: dict[str, str] = {}
    for s in segments:
        if s.speaker not in voice_of:
            voice_of[s.speaker] = next(pools["f" if s.speaker in FEMALE else "m"])

    clips, remap, cursor = [], {}, 0.0
    for s in segments:
        remap[fmt(s.start_sec)] = fmt(cursor)
        for part in chunks(s.text):
            clip = tts(part, voice_of[s.speaker])
            clips.append(clip)
            cursor += wav_seconds(clip)
        cursor += PAUSE
        print(f"  {fmt(s.start_sec)} -> {remap[fmt(s.start_sec)]}  {s.speaker} ({voice_of[s.speaker]})")

    # Concatenate with a pause after each turn's last clip, then encode a compact mono MP3.
    name = f"{slug(data['title'])}.mp3"
    silence = CACHE / "pause.wav"
    subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-f", "lavfi", "-i",
                    f"anullsrc=r={wave.open(str(clips[0])).getframerate()}:cl=mono", "-t", str(PAUSE), str(silence)], check=True)
    listing = CACHE / "concat.txt"
    lines, i = [], 0
    for s in segments:
        for _ in chunks(s.text):
            lines.append(f"file '{clips[i]}'")
            i += 1
        lines.append(f"file '{silence}'")
    listing.write_text("\n".join(lines))
    subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-f", "concat", "-safe", "0", "-i", str(listing),
                    "-ac", "1", "-b:a", "48k", str(OUT_DIR / name)], check=True)
    return name, remap


def main() -> None:
    if not _KEYS:
        sys.exit("Set GROQ_KEYS in backend/.env")
    CACHE.mkdir(exist_ok=True)
    OUT_DIR.mkdir(exist_ok=True)
    source = SEED_FILE.read_text()
    for i, data in enumerate(MEETINGS):
        print(data["title"])
        name, remap = build_meeting(data)
        # Rewrite this meeting's block only (up to the next meeting — chapters have "title" keys too):
        # transcript "[mm:ss]" stamps and the notes' "start": "mm:ss".
        start = source.index(f'"title": "{data["title"]}"')
        end = source.index(f'"title": "{MEETINGS[i + 1]["title"]}"') if i + 1 < len(MEETINGS) else len(source)
        block = source[start:end]
        block = re.sub(r"^\[(\d\d:\d\d)\]", lambda m: f"[{remap[m.group(1)]}]", block, flags=re.M)
        block = re.sub(r'"start": "(\d\d:\d\d)"', lambda m: f'"start": "{remap[m.group(1)]}"', block)
        block = re.sub(r'"audio": "[^"]*"', f'"audio": "{name}"', block) if '"audio":' in block else \
            block.replace('"days_ago":', f'"audio": "{name}", "days_ago":', 1)
        source = source[:start] + block + source[end:]
        SEED_FILE.write_text(source)  # save per meeting so a quota stop keeps finished work
        print("Updated", SEED_FILE)


if __name__ == "__main__":
    main()
