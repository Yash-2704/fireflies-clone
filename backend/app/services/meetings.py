from fastapi import Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.db import get_db
from app.models import (
    ActionItem, Chapter, Meeting, Participant, Segment, Speaker, Summary, Tag, User, utcnow,
)
from app.schemas import MeetingDetail, MeetingListItem, SpeakerOut
from app.services import ai
from app.services.transcript_parser import ParsedSegment


def current_user(db: Session = Depends(get_db)) -> User:
    """Auth is a placeholder per the brief: everyone is the seeded default user."""
    user = db.scalar(select(User).order_by(User.id))
    if not user:
        raise HTTPException(503, "Database not seeded. Run: python -m app.seed")
    return user


def get_meeting(db: Session, meeting_id: int, user: User) -> Meeting:
    meeting = db.scalar(
        select(Meeting)
        .where(Meeting.id == meeting_id, Meeting.organizer_id == user.id)
        .options(
            selectinload(Meeting.participants), selectinload(Meeting.tags),
            selectinload(Meeting.speakers), selectinload(Meeting.segments),
            selectinload(Meeting.summary), selectinload(Meeting.chapters),
            selectinload(Meeting.action_items).selectinload(ActionItem.assignee),
            selectinload(Meeting.soundbites), selectinload(Meeting.bookmarks),
            selectinload(Meeting.comments),
        )
    )
    if not meeting:
        raise HTTPException(404, "Meeting not found")
    return meeting


def participants_by_name(db: Session, names: list[str]) -> list[Participant]:
    out: dict[str, Participant] = {}
    for raw in names:
        name = " ".join(raw.split())
        if not name or name.lower() in out:
            continue
        p = db.scalar(select(Participant).where(Participant.name.ilike(name)))
        if not p:
            p = Participant(name=name)
            db.add(p)
            db.flush()  # make it visible to later lookups in this transaction
        out[name.lower()] = p
    return list(out.values())


def tags_by_name(db: Session, names: list[str]) -> list[Tag]:
    out: dict[str, Tag] = {}
    for raw in names:
        name = raw.strip().lower()
        if name and name not in out:
            tag = db.scalar(select(Tag).where(Tag.name == name))
            if not tag:
                tag = Tag(name=name)
                db.add(tag)
                db.flush()
            out[name] = tag
    return list(out.values())


def load_transcript(db: Session, meeting: Meeting, parsed: list[ParsedSegment]) -> None:
    """Create speakers + segments; speakers become participants (they attended)."""
    speaker_names = list(dict.fromkeys(p.speaker for p in parsed))
    # Generic diarization labels ("Speaker 1") are not real people, so they stay unlinked.
    people = participants_by_name(db, [n for n in speaker_names if not n.lower().startswith("speaker")])
    for person in people:
        if person not in meeting.participants:
            meeting.participants.append(person)
    db.flush()
    linked = {p.name.lower(): p.id for p in people}
    speakers = {name: Speaker(name=name, participant_id=linked.get(name.lower())) for name in speaker_names}
    meeting.speakers.extend(speakers.values())
    db.flush()
    for i, p in enumerate(parsed):
        meeting.segments.append(Segment(
            speaker_id=speakers[p.speaker].id, position=i,
            start_sec=p.start_sec, end_sec=p.end_sec, text=p.text,
        ))
    meeting.duration_sec = int(max(p.end_sec for p in parsed))


def generate_notes(db: Session, meeting: Meeting) -> dict:
    """(Re)generate summary, chapters and extracted action items for a meeting.
    Completed and manually-added action items (no start_sec) are kept. Returns the notes."""
    names = {s.id: s.name for s in meeting.speakers}
    lines = [(s.start_sec, names[s.speaker_id], s.text) for s in meeting.segments]
    notes, source = ai.generate_notes(meeting.title, lines)
    apply_notes(db, meeting, notes, source)
    return notes


def apply_notes(db: Session, meeting: Meeting, notes: dict, source: str) -> None:
    if meeting.summary:
        meeting.summary.overview, meeting.summary.source = notes["overview"], source
        meeting.summary.generated_at = utcnow()
    else:
        meeting.summary = Summary(overview=notes["overview"], source=source)
    meeting.chapters = [
        Chapter(position=i, title=c["title"], summary=c["summary"], start_sec=c["start_sec"])
        for i, c in enumerate(notes["chapters"])
    ]
    meeting.action_items = [a for a in meeting.action_items if a.is_completed or a.start_sec is None]
    by_name = {p.name.lower(): p for p in meeting.participants}
    for a in notes["action_items"]:
        assignee = by_name.get((a.get("assignee") or "").lower())
        meeting.action_items.append(ActionItem(
            text=a["text"], assignee_id=assignee.id if assignee else None, start_sec=a["start_sec"],
        ))


def to_list_item(m: Meeting) -> MeetingListItem:
    item = MeetingListItem.model_validate(m)
    item.overview = m.summary.overview if m.summary else None
    item.media_url = f"/media/{m.media_path}" if m.media_path else None
    return item


def to_detail(m: Meeting) -> MeetingDetail:
    talk: dict[int, float] = {}
    words: dict[int, int] = {}
    for s in m.segments:
        talk[s.speaker_id] = talk.get(s.speaker_id, 0) + (s.end_sec - s.start_sec)
        words[s.speaker_id] = words.get(s.speaker_id, 0) + len(s.text.split())
    total = sum(talk.values()) or 1
    speakers = [
        SpeakerOut(
            id=sp.id, name=sp.name, participant_id=sp.participant_id,
            talk_sec=round(talk.get(sp.id, 0), 1),
            talk_pct=round(100 * talk.get(sp.id, 0) / total, 1),
            wpm=round(words.get(sp.id, 0) / (talk[sp.id] / 60)) if talk.get(sp.id) else 0,
        )
        for sp in sorted(m.speakers, key=lambda sp: -talk.get(sp.id, 0))
    ]
    base = to_list_item(m).model_dump()
    return MeetingDetail(
        **base, speakers=speakers, segments=m.segments, summary=m.summary,
        chapters=m.chapters, action_items=m.action_items,
        comments=m.comments, soundbites=m.soundbites, bookmarks=m.bookmarks,
    )
