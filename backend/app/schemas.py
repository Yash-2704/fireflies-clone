from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class ORM(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class UserOut(ORM):
    id: int
    name: str
    email: str


class ParticipantOut(ORM):
    id: int
    name: str
    email: str | None = None


class TagOut(ORM):
    id: int
    name: str


class MeetingListItem(ORM):
    id: int
    title: str
    date: datetime
    duration_sec: int
    organizer: UserOut
    participants: list[ParticipantOut]
    tags: list[TagOut]
    overview: str | None = None
    media_url: str | None = None
    media_type: str | None = None


class MeetingList(BaseModel):
    meetings: list[MeetingListItem]
    total: int


class SpeakerOut(BaseModel):
    id: int
    name: str
    participant_id: int | None
    # Derived from segments at read time (Fireflies' "Speaker talktime" panel).
    talk_sec: float
    talk_pct: float
    wpm: int


class SegmentOut(ORM):
    id: int
    speaker_id: int
    start_sec: float
    end_sec: float
    text: str


class SummaryOut(ORM):
    overview: str
    source: str
    generated_at: datetime


class ChapterOut(ORM):
    id: int
    title: str
    summary: str
    start_sec: float


class ActionItemOut(ORM):
    id: int
    meeting_id: int
    text: str
    assignee: ParticipantOut | None
    is_completed: bool
    start_sec: float | None
    created_at: datetime


class CommentOut(ORM):
    id: int
    segment_id: int
    body: str
    created_at: datetime


class SoundbiteOut(ORM):
    id: int
    title: str
    start_sec: float
    end_sec: float
    created_at: datetime


class BookmarkOut(ORM):
    id: int
    kind: str
    at_sec: float
    created_at: datetime


class MeetingDetail(MeetingListItem):
    speakers: list[SpeakerOut]
    segments: list[SegmentOut]
    summary: SummaryOut | None
    chapters: list[ChapterOut]
    action_items: list[ActionItemOut]
    comments: list[CommentOut]
    soundbites: list[SoundbiteOut]
    bookmarks: list[BookmarkOut]


class CommentCreate(BaseModel):
    segment_id: int
    body: str = Field(min_length=1, max_length=2000)


class SoundbiteCreate(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    start_sec: float = Field(ge=0)
    end_sec: float = Field(gt=0)


class BookmarkCreate(BaseModel):
    kind: str = Field(pattern="^(important|action|positive|negative)$")
    at_sec: float = Field(ge=0)


class SegmentUpdate(BaseModel):
    text: str = Field(min_length=1, max_length=5000)


class Notification(BaseModel):
    kind: str  # "notes_ready" | "tasks_due"
    title: str
    body: str
    href: str
    at: datetime



class MeetingUpdate(BaseModel):
    title: str | None = Field(None, min_length=1, max_length=255)
    date: datetime | None = None
    participants: list[str] | None = None
    tags: list[str] | None = None


class SpeakerUpdate(BaseModel):
    name: str = Field(min_length=1, max_length=120)


class ActionItemCreate(BaseModel):
    text: str = Field(min_length=1)
    assignee_id: int | None = None
    start_sec: float | None = None


class ActionItemUpdate(BaseModel):
    text: str | None = Field(None, min_length=1)
    assignee_id: int | None = None
    is_completed: bool | None = None


class TaskOut(ActionItemOut):
    meeting_title: str


class SearchHit(BaseModel):
    meeting_id: int
    meeting_title: str
    meeting_date: datetime
    kind: str  # "title" | "transcript"
    snippet: str
    start_sec: float | None = None
    speaker: str | None = None


class AskMessage(BaseModel):
    role: str = Field(pattern="^(user|assistant)$")
    content: str


class AskRequest(BaseModel):
    question: str = Field(min_length=1, max_length=2000)
    history: list[AskMessage] = []


class AskResponse(BaseModel):
    answer: str
    source: str


class GlobalAskRequest(AskRequest):
    tag: str | None = None


class TopicIn(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    keywords: list[str] = Field(min_length=1, max_length=20)


class TopicOut(BaseModel):
    id: int
    name: str
    keywords: list[str]
