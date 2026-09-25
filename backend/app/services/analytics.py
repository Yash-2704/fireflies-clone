"""Conversation analytics computed from transcript segments (Fireflies' Team Insights).

All metrics are derived at request time from stored segments, so they're always consistent
with speaker renames and transcript edits.
"""

import re
from collections import defaultdict
from dataclasses import dataclass, field

MONOLOGUE_SEC = 30  # one speaker talking uninterrupted for this long counts as a monologue
MIN_SILENCE_SEC = 1.0  # gaps shorter than this are normal turn-taking, not silence
FILLERS = re.compile(
    r"\b(um+|uh+|erm|hmm+|you know|i mean|sort of|kind of|basically|actually|literally)\b", re.I)


@dataclass
class SpeakerStats:
    name: str
    meetings: set = field(default_factory=set)
    talk_sec: float = 0
    words: int = 0
    questions: int = 0
    longest_monologue_sec: float = 0

    def out(self) -> dict:
        return {"name": self.name, "meetings": len(self.meetings), "talk_sec": round(self.talk_sec, 1),
                "wpm": round(self.words / (self.talk_sec / 60)) if self.talk_sec else 0,
                "questions": self.questions, "longest_monologue_sec": round(self.longest_monologue_sec, 1)}


def count_questions(text: str) -> int:
    return len(re.findall(r"\?", text))


def turns(segments: list[tuple[str, float, float, str]]) -> list[tuple[str, float, float]]:
    """Merge consecutive segments by the same speaker into turns: (speaker, start, end)."""
    out: list[list] = []
    for speaker, start, end, _ in segments:
        if out and out[-1][0] == speaker:
            out[-1][2] = end
        else:
            out.append([speaker, start, end])
    return [tuple(t) for t in out]


def team_metrics(meetings: list[dict], user_name: str) -> dict:
    """meetings: [{"id", "duration_sec", "segments": [(speaker, start, end, text), ...]}]"""
    speakers: dict[str, SpeakerStats] = defaultdict(lambda: SpeakerStats(""))
    totals = defaultdict(float)
    user_talk = user_meeting_talk = 0.0
    for m in meetings:
        totals["duration_sec"] += m["duration_sec"]
        segs = sorted(m["segments"], key=lambda s: s[1])
        meeting_talk = 0.0
        for i, (speaker, start, end, text) in enumerate(segs):
            st = speakers[speaker]
            st.name = speaker
            st.meetings.add(m["id"])
            st.talk_sec += end - start
            st.words += len(text.split())
            q = count_questions(text)
            st.questions += q
            totals["questions"] += q
            totals["fillers"] += len(FILLERS.findall(text))
            meeting_talk += end - start
            if i and start - segs[i - 1][2] >= MIN_SILENCE_SEC:
                totals["silence_sec"] += start - segs[i - 1][2]
        for speaker, start, end in turns(segs):
            if end - start >= MONOLOGUE_SEC:
                totals["monologues"] += 1
                totals["longest_monologue_sec"] = max(totals["longest_monologue_sec"], end - start)
                speakers[speaker].longest_monologue_sec = max(speakers[speaker].longest_monologue_sec, end - start)
        # Talk-to-listen ratio only makes sense for meetings the user actually spoke in.
        mine = sum(e - s for sp, s, e, _ in segs if sp == user_name)
        if mine:
            user_talk += mine
            user_meeting_talk += meeting_talk
    talk_sec = sum(s.talk_sec for s in speakers.values())
    words = sum(s.words for s in speakers.values())
    return {
        "conversations": len(meetings),
        "duration_sec": round(totals["duration_sec"]),
        "questions": int(totals["questions"]),
        "fillers": int(totals["fillers"]),
        "monologues": int(totals["monologues"]),
        "longest_monologue_sec": round(totals["longest_monologue_sec"], 1),
        "talk_pct": round(100 * user_talk / user_meeting_talk, 1) if user_meeting_talk else None,
        "wpm": round(words / (talk_sec / 60)) if talk_sec else 0,
        "silence_sec": round(totals["silence_sec"]),
        "speakers": sorted((s.out() for s in speakers.values()), key=lambda s: -s["talk_sec"]),
    }


def keyword_hits(text: str, keyword: str) -> int:
    return len(re.findall(rf"(?<!\w){re.escape(keyword)}(?!\w)", text, re.I))


if __name__ == "__main__":
    m = {"id": 1, "duration_sec": 100, "segments": [
        ("Ann", 0, 20, "Um, so what's the plan? You know, basically"),
        ("Ann", 20, 40, "we ship Friday."),
        ("Bob", 45, 50, "Okay?"),
    ]}
    r = team_metrics([m], "Ann")
    assert r["questions"] == 2 and r["fillers"] == 3, r
    assert r["monologues"] == 1 and r["longest_monologue_sec"] == 40  # Ann's two lines form one 40s turn
    assert r["silence_sec"] == 5 and r["talk_pct"] == 88.9  # 40s of 45s spoken
    assert r["speakers"][0]["name"] == "Ann" and r["speakers"][0]["questions"] == 1
    assert keyword_hits("Security first; SOC 2 security.", "security") == 2
    assert keyword_hits("insecurity", "security") == 0
    assert team_metrics([], "Ann")["talk_pct"] is None
    print("ok")
