from datetime import datetime

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.db import get_db
from app.models import Meeting, Participant, Speaker, Tag, User, meeting_participants, meeting_tags
from app.schemas import (
    AskRequest, AskResponse, MeetingDetail, MeetingList, MeetingUpdate, SpeakerUpdate,
)
from app.services import ai
from app.services.meetings import (
    current_user, generate_notes, get_meeting, load_transcript, participants_by_name,
    tags_by_name, to_detail, to_list_item,
)
from app.services.transcript_parser import TranscriptParseError, parse_transcript

router = APIRouter(prefix="/meetings", tags=["meetings"])

MAX_UPLOAD_BYTES = 2_000_000


@router.get("", response_model=MeetingList)
def list_meetings(
    q: str | None = Query(None, description="Matches title or participant name"),
    participant_id: list[int] = Query([], description="Meetings attended by any of these"),
    tag: str | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    min_duration: int | None = Query(None, description="Minutes"),
    max_duration: int | None = Query(None, description="Minutes"),
    sort: str = Query("recent", pattern="^(recent|oldest)$"),
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
):
    stmt = select(Meeting).where(Meeting.organizer_id == user.id)
    if q:
        attended = select(meeting_participants.c.meeting_id).join(Participant).where(
            Participant.name.ilike(f"%{q}%"))
        stmt = stmt.where(or_(Meeting.title.ilike(f"%{q}%"), Meeting.id.in_(attended)))
    if participant_id:
        stmt = stmt.where(Meeting.id.in_(select(meeting_participants.c.meeting_id).where(
            meeting_participants.c.participant_id.in_(participant_id))))
    if tag:
        stmt = stmt.where(Meeting.id.in_(
            select(meeting_tags.c.meeting_id).join(Tag).where(Tag.name == tag.lower())))
    if date_from:
        stmt = stmt.where(Meeting.date >= date_from)
    if date_to:
        stmt = stmt.where(Meeting.date <= date_to)
    if min_duration is not None:
        stmt = stmt.where(Meeting.duration_sec >= min_duration * 60)
    if max_duration is not None:
        stmt = stmt.where(Meeting.duration_sec <= max_duration * 60)
    stmt = stmt.order_by(Meeting.date.asc() if sort == "oldest" else Meeting.date.desc()).options(
        selectinload(Meeting.participants), selectinload(Meeting.tags),
        selectinload(Meeting.summary), selectinload(Meeting.organizer),
    )
    meetings = [to_list_item(m) for m in db.scalars(stmt)]
    return MeetingList(meetings=meetings, total=len(meetings))


@router.post("", response_model=MeetingDetail, status_code=201)
async def create_meeting(
    title: str = Form("", max_length=255),
    date: datetime | None = Form(None),
    participants: str = Form("", description="Comma-separated names"),
    tags: str = Form("", description="Comma-separated tags"),
    transcript_text: str = Form(""),
    file: UploadFile | None = File(None, description=".txt, .vtt, .srt or .json transcript"),
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
):
    """Create a meeting from a pasted or uploaded transcript, then generate AI notes."""
    filename = ""
    if file and file.filename:
        raw = await file.read(MAX_UPLOAD_BYTES + 1)
        if len(raw) > MAX_UPLOAD_BYTES:
            raise HTTPException(413, "Transcript file is larger than 2 MB")
        try:
            transcript_text = raw.decode("utf-8")
        except UnicodeDecodeError:
            raise HTTPException(422, "Transcript must be a UTF-8 text file (.txt, .vtt, .srt, .json)")
        filename = file.filename
    try:
        parsed = parse_transcript(transcript_text, filename)
    except TranscriptParseError as e:
        raise HTTPException(422, str(e))

    fallback_title = filename.rsplit(".", 1)[0] if filename else "Untitled meeting"
    meeting = Meeting(title=title.strip() or fallback_title, date=date or datetime.now(), organizer=user)
    meeting.participants = participants_by_name(db, participants.split(","))
    meeting.tags = tags_by_name(db, tags.split(","))
    db.add(meeting)
    load_transcript(db, meeting, parsed)
    generate_notes(db, meeting)
    db.commit()
    return to_detail(get_meeting(db, meeting.id, user))


@router.get("/{meeting_id}", response_model=MeetingDetail)
def read_meeting(meeting_id: int, db: Session = Depends(get_db), user: User = Depends(current_user)):
    return to_detail(get_meeting(db, meeting_id, user))


@router.patch("/{meeting_id}", response_model=MeetingDetail)
def update_meeting(
    meeting_id: int, body: MeetingUpdate,
    db: Session = Depends(get_db), user: User = Depends(current_user),
):
    meeting = get_meeting(db, meeting_id, user)
    if body.title is not None:
        meeting.title = body.title.strip()
    if body.date is not None:
        meeting.date = body.date
    if body.participants is not None:
        meeting.participants = participants_by_name(db, body.participants)
    if body.tags is not None:
        meeting.tags = tags_by_name(db, body.tags)
    db.commit()
    return to_detail(get_meeting(db, meeting_id, user))


@router.delete("/{meeting_id}", status_code=204)
def delete_meeting(meeting_id: int, db: Session = Depends(get_db), user: User = Depends(current_user)):
    db.delete(get_meeting(db, meeting_id, user))
    db.commit()


@router.post("/{meeting_id}/notes", response_model=MeetingDetail)
def regenerate_notes(meeting_id: int, db: Session = Depends(get_db), user: User = Depends(current_user)):
    """Fireflies' "Regenerate notes": re-run the LLM over the stored transcript."""
    meeting = get_meeting(db, meeting_id, user)
    generate_notes(db, meeting)
    db.commit()
    return to_detail(get_meeting(db, meeting_id, user))


@router.patch("/{meeting_id}/speakers/{speaker_id}", response_model=MeetingDetail)
def rename_speaker(
    meeting_id: int, speaker_id: int, body: SpeakerUpdate,
    db: Session = Depends(get_db), user: User = Depends(current_user),
):
    """Rename a speaker (e.g. "Speaker 1" -> "Priya") and link them as a participant."""
    meeting = get_meeting(db, meeting_id, user)
    speaker = next((s for s in meeting.speakers if s.id == speaker_id), None)
    if not speaker:
        raise HTTPException(404, "Speaker not found")
    name = " ".join(body.name.split())
    if any(s.name.lower() == name.lower() and s.id != speaker_id for s in meeting.speakers):
        raise HTTPException(409, f"Another speaker is already named {name}")
    person = participants_by_name(db, [name])[0]
    if person not in meeting.participants:
        meeting.participants.append(person)
    db.flush()
    speaker.name, speaker.participant_id = name, person.id
    db.commit()
    return to_detail(get_meeting(db, meeting_id, user))


@router.post("/{meeting_id}/ask", response_model=AskResponse)
def ask_fred(
    meeting_id: int, body: AskRequest,
    db: Session = Depends(get_db), user: User = Depends(current_user),
):
    meeting = get_meeting(db, meeting_id, user)
    names = {s.id: s.name for s in meeting.speakers}
    parts = [f"Meeting: {meeting.title} ({meeting.date:%b %d %Y})",
             f"Participants: {', '.join(p.name for p in meeting.participants) or 'unknown'}"]
    if meeting.summary:
        parts.append(f"Summary: {meeting.summary.overview}")
    if meeting.action_items:
        parts.append("Action items:\n" + "\n".join(
            f"- {a.text}" + (f" ({a.assignee.name})" if a.assignee else "") for a in meeting.action_items))
    parts.append("Transcript:\n" + ai.transcript_as_text(
        [(s.start_sec, names[s.speaker_id], s.text) for s in meeting.segments]))
    answer, source = ai.answer_question("\n\n".join(parts), body.question,
                                        [m.model_dump() for m in body.history])
    return AskResponse(answer=answer, source=source)
