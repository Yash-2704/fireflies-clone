"""Turn an uploaded or pasted transcript into timed, speaker-labelled segments.

Supported inputs:
- WebVTT / SRT:  cue timings are kept; speaker from `<v Name>` or a `Name:` prefix.
- JSON:          a list (or {"segments"|"transcript"|"lines": [...]}) of objects with
                 text/speaker and optional start/end (seconds or "mm:ss").
- Plain text:    lines like `[00:12] Alice: hi`, `00:12 Alice: hi` or `Alice: hi`.
Lines without timings get estimated ones (~150 words/min) so seeking still works.
"""

import json
import re
from dataclasses import dataclass

WORDS_PER_SEC = 2.5
UNKNOWN_SPEAKER = "Speaker 1"

_TIME = r"(?:\d{1,2}:)?\d{1,2}:\d{2}(?:[.,]\d{1,3})?"
_CUE = re.compile(rf"^({_TIME})\s*-->\s*({_TIME})")
_TEXT_LINE = re.compile(rf"^\[?({_TIME})?\]?\s*(?:([^:\[\]]{{1,60}}):\s+)?(.+)$")
_VOICE = re.compile(r"^<v\s+([^>]+)>(.*?)(?:</v>)?$")


@dataclass
class ParsedSegment:
    speaker: str
    text: str
    start_sec: float | None = None
    end_sec: float | None = None


class TranscriptParseError(ValueError):
    pass


def to_seconds(value) -> float:
    if isinstance(value, (int, float)):
        return float(value)
    parts = [float(p) for p in str(value).replace(",", ".").split(":")]
    total = 0.0
    for p in parts:
        total = total * 60 + p
    return total


def _split_speaker(text: str) -> tuple[str | None, str]:
    voice = _VOICE.match(text)
    if voice:
        return voice.group(1).strip(), voice.group(2).strip()
    m = re.match(r"^([^:]{1,60}):\s+(.+)$", text)
    if m and not m.group(1).startswith("http"):
        return m.group(1).strip(), m.group(2).strip()
    return None, text


def _parse_cues(content: str) -> list[ParsedSegment]:
    """WebVTT and SRT share the `start --> end` cue format."""
    segments: list[ParsedSegment] = []
    lines = content.splitlines()
    i = 0
    while i < len(lines):
        cue = _CUE.match(lines[i].strip())
        i += 1
        if not cue:
            continue
        body = []
        while i < len(lines) and lines[i].strip():
            body.append(lines[i].strip())
            i += 1
        speaker, text = _split_speaker(" ".join(body))
        if text:
            segments.append(ParsedSegment(
                speaker or UNKNOWN_SPEAKER, re.sub(r"<[^>]+>", "", text),
                to_seconds(cue.group(1)), to_seconds(cue.group(2)),
            ))
    return segments


def _parse_json(content: str) -> list[ParsedSegment]:
    try:
        data = json.loads(content)
    except json.JSONDecodeError as e:
        raise TranscriptParseError(f"Invalid JSON: {e.msg}") from e
    if isinstance(data, dict):
        data = next((data[k] for k in ("segments", "transcript", "lines") if isinstance(data.get(k), list)), None)
    if not isinstance(data, list):
        raise TranscriptParseError("JSON must be a list of segments or contain a 'segments' list")
    segments = []
    for row in data:
        if not isinstance(row, dict):
            continue
        text = str(row.get("text") or row.get("content") or "").strip()
        if not text:
            continue
        start = row.get("start", row.get("start_sec", row.get("start_time")))
        end = row.get("end", row.get("end_sec", row.get("end_time")))
        segments.append(ParsedSegment(
            str(row.get("speaker") or row.get("speaker_name") or UNKNOWN_SPEAKER).strip(),
            text,
            to_seconds(start) if start is not None else None,
            to_seconds(end) if end is not None else None,
        ))
    return segments


def _parse_text(content: str) -> list[ParsedSegment]:
    segments = []
    for raw in content.splitlines():
        line = raw.strip()
        if not line:
            continue
        m = _TEXT_LINE.match(line)
        stamp, speaker, text = m.group(1), m.group(2), m.group(3).strip()
        if speaker is None and segments and stamp is None:
            # Continuation of the previous speaker's paragraph.
            segments[-1].text += " " + text
            continue
        segments.append(ParsedSegment(
            (speaker or (segments[-1].speaker if segments else UNKNOWN_SPEAKER)).strip(),
            text, to_seconds(stamp) if stamp else None,
        ))
    return segments


def _fill_timings(segments: list[ParsedSegment]) -> None:
    """Estimate missing start/end from word counts so every line is seekable."""
    cursor = 0.0
    for i, seg in enumerate(segments):
        if seg.start_sec is None:
            seg.start_sec = cursor
        spoken = max(1.0, len(seg.text.split()) / WORDS_PER_SEC)
        if seg.end_sec is None:
            nxt = segments[i + 1].start_sec if i + 1 < len(segments) else None
            seg.end_sec = nxt if nxt is not None and nxt > seg.start_sec else seg.start_sec + spoken
        cursor = seg.end_sec


def _looks_like_json(content: str) -> bool:
    # Pasted text may start with "[00:10]", so only sniff JSON if it actually parses.
    try:
        json.loads(content)
        return True
    except json.JSONDecodeError:
        return False


def parse_transcript(content: str, filename: str = "") -> list[ParsedSegment]:
    content = content.lstrip("﻿").strip()
    if not content:
        raise TranscriptParseError("Transcript is empty")
    name = filename.lower()
    if name.endswith(".json") or (not name and _looks_like_json(content)):
        segments = _parse_json(content)
    elif name.endswith((".vtt", ".srt")) or "-->" in content:
        segments = _parse_cues(content)
    else:
        segments = _parse_text(content)
    if not segments:
        raise TranscriptParseError("No transcript lines found")
    _fill_timings(segments)
    return segments


if __name__ == "__main__":
    vtt = "WEBVTT\n\n1\n00:00:01.000 --> 00:00:04.500\n<v Alice>Hello team</v>\n\n00:05.000 --> 00:07.000\nBob: Hi"
    s = parse_transcript(vtt, "a.vtt")
    assert [(x.speaker, x.text, x.start_sec, x.end_sec) for x in s] == [
        ("Alice", "Hello team", 1.0, 4.5), ("Bob", "Hi", 5.0, 7.0)]
    s = parse_transcript("[00:10] Alice: one two\nmore words\nBob: three")
    assert s[0].start_sec == 10 and s[0].text == "one two more words" and s[1].speaker == "Bob"
    assert s[1].start_sec == s[0].end_sec
    s = parse_transcript('{"segments":[{"speaker":"A","text":"x","start":"01:05"}]}', "t.json")
    assert s[0].start_sec == 65
    assert parse_transcript("just some words")[0].speaker == UNKNOWN_SPEAKER
    print("ok")
