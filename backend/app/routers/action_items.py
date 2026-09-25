from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.db import get_db
from app.models import ActionItem, Meeting, User
from app.schemas import ActionItemCreate, ActionItemOut, ActionItemUpdate, TaskOut
from app.services.meetings import current_user, get_meeting

router = APIRouter(tags=["action items"])


def _owned_item(db: Session, item_id: int, user: User) -> ActionItem:
    item = db.scalar(
        select(ActionItem).join(Meeting)
        .where(ActionItem.id == item_id, Meeting.organizer_id == user.id)
        .options(selectinload(ActionItem.assignee), selectinload(ActionItem.meeting))
    )
    if not item:
        raise HTTPException(404, "Action item not found")
    return item


def _check_assignee(meeting: Meeting, assignee_id: int | None) -> None:
    if assignee_id is not None and assignee_id not in {p.id for p in meeting.participants}:
        raise HTTPException(422, "Assignee must be a participant of this meeting")


@router.get("/action-items", response_model=list[TaskOut])
def list_tasks(
    status: str = Query("all", pattern="^(all|open|done)$"),
    db: Session = Depends(get_db), user: User = Depends(current_user),
):
    """All action items across meetings (the Tasks page)."""
    stmt = (select(ActionItem).join(Meeting).where(Meeting.organizer_id == user.id)
            .options(selectinload(ActionItem.assignee), selectinload(ActionItem.meeting))
            .order_by(Meeting.date.desc(), ActionItem.id))
    if status != "all":
        stmt = stmt.where(ActionItem.is_completed == (status == "done"))
    return [TaskOut(**ActionItemOut.model_validate(a).model_dump(), meeting_title=a.meeting.title)
            for a in db.scalars(stmt)]


@router.post("/meetings/{meeting_id}/action-items", response_model=ActionItemOut, status_code=201)
def create_item(
    meeting_id: int, body: ActionItemCreate,
    db: Session = Depends(get_db), user: User = Depends(current_user),
):
    meeting = get_meeting(db, meeting_id, user)
    _check_assignee(meeting, body.assignee_id)
    item = ActionItem(meeting_id=meeting.id, text=body.text.strip(),
                      assignee_id=body.assignee_id, start_sec=body.start_sec)
    db.add(item)
    db.commit()
    return _owned_item(db, item.id, user)


@router.patch("/action-items/{item_id}", response_model=ActionItemOut)
def update_item(
    item_id: int, body: ActionItemUpdate,
    db: Session = Depends(get_db), user: User = Depends(current_user),
):
    item = _owned_item(db, item_id, user)
    changes = body.model_dump(exclude_unset=True)
    if "assignee_id" in changes:
        _check_assignee(get_meeting(db, item.meeting_id, user), changes["assignee_id"])
    for field, value in changes.items():
        setattr(item, field, value.strip() if isinstance(value, str) else value)
    db.commit()
    return _owned_item(db, item_id, user)


@router.delete("/action-items/{item_id}", status_code=204)
def delete_item(item_id: int, db: Session = Depends(get_db), user: User = Depends(current_user)):
    db.delete(_owned_item(db, item_id, user))
    db.commit()
