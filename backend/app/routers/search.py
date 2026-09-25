from datetime import datetime

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.db import get_db

from app.models import (
    ActionItem, Meeting, Participant, Segment, Speaker, Tag, User, meeting_participants, meeting_tags,
)
from app.schemas import (
    AskResponse, GlobalAskRequest, Notification, ParticipantOut, SearchHit, TagOut, UserOut,
)
from app.services import ai
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


WORKSPACE_ASK_MEETINGS = 15  # most recent meetings given to the LLM (fits Groq's free-tier token budget)


@router.post("/ask", response_model=AskResponse)
def ask_across_meetings(body: GlobalAskRequest, db: Session = Depends(get_db),
                        user: User = Depends(current_user)):
    """AskFred over the workspace: answers from recent meetings' summaries and action items.
    Optionally scoped to a tag (a library "channel")."""
    stmt = (select(Meeting).where(Meeting.organizer_id == user.id)
            .options(selectinload(Meeting.summary),
                     selectinload(Meeting.action_items).selectinload(ActionItem.assignee))
            .order_by(Meeting.date.desc()).limit(WORKSPACE_ASK_MEETINGS))
    if body.tag:
        stmt = stmt.where(Meeting.id.in_(
            select(meeting_tags.c.meeting_id).join(Tag).where(Tag.name == body.tag.lower())))
    blocks = []
    for m in db.scalars(stmt):
        items = "\n".join(
            f"- {'[done] ' if a.is_completed else ''}{a.text}" + (f" ({a.assignee.name})" if a.assignee else "")
            for a in m.action_items)
        blocks.append(f"## {m.title} ({m.date:%a %b %d %Y})\n"
                      f"Summary: {m.summary.overview if m.summary else 'n/a'}\nAction items:\n{items or '- none'}")
    if not blocks:
        return AskResponse(answer="There are no meetings to search yet.", source="heuristic")
    answer, source = ai.answer_question(
        f"Today is {datetime.now():%a %b %d %Y}. The user is {user.name}.\n\n" + "\n\n".join(blocks),
        body.question, [m.model_dump() for m in body.history], prompt=ai.WORKSPACE_PROMPT)
    return AskResponse(answer=answer, source=source)


@router.get("/notifications", response_model=list[Notification])
def notifications(db: Session = Depends(get_db), user: User = Depends(current_user)):
    """Activity feed built from real workspace events (no separate notifications table needed)."""
    recent = db.scalars(select(Meeting).where(Meeting.organizer_id == user.id)
                        .order_by(Meeting.created_at.desc()).limit(8))
    feed = [Notification(kind="notes_ready", title="Notes are ready", body=m.title,
                         href=f"/meetings/{m.id}", at=m.created_at) for m in recent]
    mine = db.scalars(select(ActionItem).join(Meeting).join(Participant, ActionItem.assignee)
                      .where(Meeting.organizer_id == user.id, ActionItem.is_completed.is_(False),
                             Participant.name == user.name)).all()
    if mine:
        feed.append(Notification(kind="tasks_due", title=f"You have {len(mine)} open action items",
                                 body="; ".join(a.text for a in mine[:2]) + ("…" if len(mine) > 2 else ""),
                                 href="/tasks", at=max(a.created_at for a in mine)))
    return sorted(feed, key=lambda n: n.at, reverse=True)
