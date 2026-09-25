from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import Bookmark, Comment, Meeting, Segment, Soundbite, User
from app.schemas import (
    BookmarkCreate, BookmarkOut, CommentCreate, CommentOut, SegmentOut, SegmentUpdate,
    SoundbiteCreate, SoundbiteOut,
)
from app.services.meetings import current_user, get_meeting

router = APIRouter(tags=["annotations"])


def _owned(db: Session, model, item_id: int, user: User, via_segment: bool = False):
    """Load a meeting-owned row, 404 if it belongs to someone else's meeting."""
    stmt = select(model).where(model.id == item_id)
    stmt = stmt.join(Segment).join(Meeting) if via_segment else stmt.join(Meeting)
    item = db.scalar(stmt.where(Meeting.organizer_id == user.id))
    if not item:
        raise HTTPException(404, f"{model.__name__} not found")
    return item


@router.post("/meetings/{meeting_id}/comments", response_model=CommentOut, status_code=201)
def add_comment(meeting_id: int, body: CommentCreate,
                db: Session = Depends(get_db), user: User = Depends(current_user)):
    meeting = get_meeting(db, meeting_id, user)
    if body.segment_id not in {s.id for s in meeting.segments}:
        raise HTTPException(422, "That transcript line isn't part of this meeting")
    comment = Comment(segment_id=body.segment_id, body=body.body.strip())
    db.add(comment)
    db.commit()
    return comment


@router.delete("/comments/{comment_id}", status_code=204)
def delete_comment(comment_id: int, db: Session = Depends(get_db), user: User = Depends(current_user)):
    db.delete(_owned(db, Comment, comment_id, user, via_segment=True))
    db.commit()


@router.post("/meetings/{meeting_id}/soundbites", response_model=SoundbiteOut, status_code=201)
def add_soundbite(meeting_id: int, body: SoundbiteCreate,
                  db: Session = Depends(get_db), user: User = Depends(current_user)):
    meeting = get_meeting(db, meeting_id, user)
    if body.end_sec <= body.start_sec:
        raise HTTPException(422, "A soundbite must end after it starts")
    clip = Soundbite(meeting_id=meeting.id, title=body.title.strip(), start_sec=body.start_sec,
                     end_sec=min(body.end_sec, meeting.duration_sec or body.end_sec))
    db.add(clip)
    db.commit()
    return clip


@router.delete("/soundbites/{soundbite_id}", status_code=204)
def delete_soundbite(soundbite_id: int, db: Session = Depends(get_db), user: User = Depends(current_user)):
    db.delete(_owned(db, Soundbite, soundbite_id, user))
    db.commit()


@router.post("/meetings/{meeting_id}/bookmarks", response_model=BookmarkOut, status_code=201)
def add_bookmark(meeting_id: int, body: BookmarkCreate,
                 db: Session = Depends(get_db), user: User = Depends(current_user)):
    meeting = get_meeting(db, meeting_id, user)
    mark = Bookmark(meeting_id=meeting.id, kind=body.kind, at_sec=body.at_sec)
    db.add(mark)
    db.commit()
    return mark


@router.delete("/bookmarks/{bookmark_id}", status_code=204)
def delete_bookmark(bookmark_id: int, db: Session = Depends(get_db), user: User = Depends(current_user)):
    db.delete(_owned(db, Bookmark, bookmark_id, user))
    db.commit()


@router.patch("/segments/{segment_id}", response_model=SegmentOut)
def edit_segment(segment_id: int, body: SegmentUpdate,
                 db: Session = Depends(get_db), user: User = Depends(current_user)):
    """Fix a transcript line (e.g. a word Whisper misheard)."""
    segment = _owned(db, Segment, segment_id, user)
    segment.text = " ".join(body.text.split())
    db.commit()
    return segment
