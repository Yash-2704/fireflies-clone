from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import Meeting, Participant, Segment, Speaker, Tag, User, meeting_participants, meeting_tags
from app.schemas import ParticipantOut, SearchHit, TagOut, UserOut
from app.services.meetings import current_user

router = APIRouter(tags=["search"])

SNIPPET_RADIUS = 60


def _snippet(text: str, q: str) -> str:
    i = text.lower().find(q.lower())
    start, end = max(0, i - SNIPPET_RADIUS), i + len(q) + SNIPPET_RADIUS
    return ("…" if start else "") + text[start:end] + ("…" if end < len(text) else "")


@router.get("/search", response_model=list[SearchHit])
def global_search(
    q: str = Query(min_length=2), limit: int = Query(30, le=100),
    db: Session = Depends(get_db), user: User = Depends(current_user),
):
    """Search across all meetings: title matches first, then transcript lines."""
    like = f"%{q}%"
    hits = [
        SearchHit(meeting_id=m.id, meeting_title=m.title, meeting_date=m.date, kind="title", snippet=m.title)
        for m in db.scalars(select(Meeting).where(
            Meeting.organizer_id == user.id, Meeting.title.ilike(like)).order_by(Meeting.date.desc()))
    ]
    rows = db.execute(
        select(Segment, Meeting, Speaker.name)
        .join(Meeting, Segment.meeting_id == Meeting.id)
        .join(Speaker, Segment.speaker_id == Speaker.id)
        .where(Meeting.organizer_id == user.id, Segment.text.ilike(like))
        .order_by(Meeting.date.desc(), Segment.position).limit(limit)
    )
    hits += [
        SearchHit(meeting_id=m.id, meeting_title=m.title, meeting_date=m.date, kind="transcript",
                  snippet=_snippet(s.text, q), start_sec=s.start_sec, speaker=name)
        for s, m, name in rows
    ]
    return hits[:limit]


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(current_user)):
    return user


@router.get("/participants", response_model=list[ParticipantOut])
def list_participants(db: Session = Depends(get_db), user: User = Depends(current_user)):
    """People who attended the user's meetings (for the library's participant filter)."""
    return db.scalars(
        select(Participant).join(meeting_participants).join(Meeting)
        .where(Meeting.organizer_id == user.id).distinct().order_by(Participant.name)
    ).all()


@router.get("/tags", response_model=list[TagOut])
def list_tags(db: Session = Depends(get_db), user: User = Depends(current_user)):
    return db.scalars(
        select(Tag).join(meeting_tags).join(Meeting)
        .where(Meeting.organizer_id == user.id).distinct().order_by(Tag.name)
    ).all()
