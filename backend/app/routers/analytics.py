from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.db import get_db
from app.models import Meeting, Tag, TopicTracker, User, meeting_participants, meeting_tags, to_utc, utcnow
from app.schemas import TopicIn, TopicOut
from app.services.analytics import keyword_hits, team_metrics
from app.services.meetings import current_user

router = APIRouter(tags=["analytics"])


def _meetings(db: Session, user: User, start: datetime, end: datetime,
              participant_id: list[int], tag: str | None) -> list[Meeting]:
    stmt = (select(Meeting)
            .where(Meeting.organizer_id == user.id, Meeting.date >= start, Meeting.date < end)
            .options(selectinload(Meeting.segments), selectinload(Meeting.speakers)))
    if participant_id:
        stmt = stmt.where(Meeting.id.in_(select(meeting_participants.c.meeting_id).where(
            meeting_participants.c.participant_id.in_(participant_id))))
    if tag:
        stmt = stmt.where(Meeting.id.in_(
            select(meeting_tags.c.meeting_id).join(Tag).where(Tag.name == tag.lower())))
    return list(db.scalars(stmt))


def _as_rows(meetings: list[Meeting]) -> list[dict]:
    rows = []
    for m in meetings:
        names = {s.id: s.name for s in m.speakers}
        rows.append({"id": m.id, "duration_sec": m.duration_sec,
                     "segments": [(names[s.speaker_id], s.start_sec, s.end_sec, s.text) for s in m.segments]})
    return rows


def _iso(dt: datetime) -> str:
    return dt.replace(tzinfo=timezone.utc).isoformat()


def _window(date_from: datetime | None, date_to: datetime | None) -> tuple[datetime, datetime]:
    end = to_utc(date_to) or utcnow()
    start = to_utc(date_from) or end - timedelta(days=7)
    if start >= end:
        raise HTTPException(422, "date_from must be before date_to")
    return start, end


@router.get("/analytics/team")
def team_insights(
    date_from: datetime | None = None, date_to: datetime | None = None,
    participant_id: list[int] = Query([]), tag: str | None = None,
    db: Session = Depends(get_db), user: User = Depends(current_user),
):
    """Team Insights for [date_from, date_to) plus the same-length previous period for deltas."""
    start, end = _window(date_from, date_to)
    current = _meetings(db, user, start, end, participant_id, tag)
    previous = _meetings(db, user, start - (end - start), start, participant_id, tag)
    prev = team_metrics(_as_rows(previous), user.name)
    prev.pop("speakers")
    return {
        "from": _iso(start), "to": _iso(end),
        "current": team_metrics(_as_rows(current), user.name),
        "previous": prev,
        # Per meeting, not per day: "which day" depends on the viewer's timezone, so the client buckets.
        "meetings": [{"date": _iso(m.date), "minutes": round(m.duration_sec / 60, 1)} for m in current],
    }


def _topic_out(t: TopicTracker) -> TopicOut:
    return TopicOut(id=t.id, name=t.name, keywords=[k for k in t.keywords.split(",") if k])


@router.get("/topics", response_model=list[TopicOut])
def list_topics(db: Session = Depends(get_db), user: User = Depends(current_user)):
    return [_topic_out(t) for t in db.scalars(
        select(TopicTracker).where(TopicTracker.owner_id == user.id).order_by(TopicTracker.name))]


@router.post("/topics", response_model=TopicOut, status_code=201)
def create_topic(body: TopicIn, db: Session = Depends(get_db), user: User = Depends(current_user)):
    keywords = list(dict.fromkeys(k.strip().lower() for k in body.keywords if k.strip() and "," not in k))
    if not keywords:
        raise HTTPException(422, "Add at least one keyword")
    topic = TopicTracker(owner_id=user.id, name=body.name.strip(), keywords=",".join(keywords))
    db.add(topic)
    db.commit()
    return _topic_out(topic)


@router.delete("/topics/{topic_id}", status_code=204)
def delete_topic(topic_id: int, db: Session = Depends(get_db), user: User = Depends(current_user)):
    topic = db.scalar(select(TopicTracker).where(TopicTracker.id == topic_id, TopicTracker.owner_id == user.id))
    if not topic:
        raise HTTPException(404, "Topic not found")
    db.delete(topic)
    db.commit()


@router.get("/analytics/topics")
def topic_insights(
    date_from: datetime | None = None, date_to: datetime | None = None,
    participant_id: list[int] = Query([]), tag: str | None = None,
    db: Session = Depends(get_db), user: User = Depends(current_user),
):
    """Per topic: how many meetings mention it and how often, broken down by keyword."""
    start, end = _window(date_from, date_to)
    texts = [(m.id, " ".join(s.text for s in m.segments))
             for m in _meetings(db, user, start, end, participant_id, tag)]
    out = []
    for topic in list_topics(db, user):
        rows, hit_meetings = [], set()
        for kw in topic.keywords:
            per_meeting = {mid: n for mid, text in texts if (n := keyword_hits(text, kw))}
            hit_meetings |= per_meeting.keys()
            rows.append({"keyword": kw, "conversations": len(per_meeting), "mentions": sum(per_meeting.values())})
        out.append({"id": topic.id, "name": topic.name, "conversations": len(hit_meetings),
                    "mentions": sum(r["mentions"] for r in rows),
                    "keywords": sorted(rows, key=lambda r: -r["mentions"])})
    return out
