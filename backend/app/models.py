from datetime import datetime, timezone

from sqlalchemy import (
    Boolean, Column, DateTime, Float, ForeignKey, Index, Integer, String, Table, Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


# Convention: every datetime is stored as naive UTC. The API marks them as UTC on the way out
# (schemas.UTCDateTime) and converts incoming aware datetimes with to_utc().
def utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def to_utc(dt: datetime | None) -> datetime | None:
    """Aware -> naive UTC; naive values are assumed to already be UTC."""
    if dt is None or dt.tzinfo is None:
        return dt
    return dt.astimezone(timezone.utc).replace(tzinfo=None)


meeting_participants = Table(
    "meeting_participants",
    Base.metadata,
    Column("meeting_id", ForeignKey("meetings.id", ondelete="CASCADE"), primary_key=True),
    Column("participant_id", ForeignKey("participants.id", ondelete="CASCADE"), primary_key=True),
)

meeting_tags = Table(
    "meeting_tags",
    Base.metadata,
    Column("meeting_id", ForeignKey("meetings.id", ondelete="CASCADE"), primary_key=True),
    Column("tag_id", ForeignKey("tags.id", ondelete="CASCADE"), primary_key=True),
)


class User(Base):
    """The workspace owner. Auth is out of scope, so one default user is seeded."""
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    email: Mapped[str] = mapped_column(String(255), unique=True)


class Participant(Base):
    """A person who attends meetings. Shared across meetings so we can filter by attendee."""
    __tablename__ = "participants"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120), unique=True)
    email: Mapped[str | None] = mapped_column(String(255))


class Tag(Base):
    __tablename__ = "tags"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(60), unique=True)


class Meeting(Base):
    __tablename__ = "meetings"

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(255))
    date: Mapped[datetime] = mapped_column(DateTime, index=True)
    duration_sec: Mapped[int] = mapped_column(Integer, default=0)
    organizer_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    # Recording file name inside MEDIA_DIR (null for meetings created from a transcript only).
    media_path: Mapped[str | None] = mapped_column(String(255))
    media_type: Mapped[str | None] = mapped_column(String(10))  # "audio" | "video"
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow)

    organizer: Mapped[User] = relationship()
    participants: Mapped[list[Participant]] = relationship(
        secondary=meeting_participants, order_by=Participant.name
    )
    tags: Mapped[list[Tag]] = relationship(secondary=meeting_tags, order_by=Tag.name)
    speakers: Mapped[list["Speaker"]] = relationship(
        back_populates="meeting", cascade="all, delete-orphan", passive_deletes=True
    )
    segments: Mapped[list["Segment"]] = relationship(
        back_populates="meeting", cascade="all, delete-orphan", passive_deletes=True,
        order_by="Segment.position",
    )
    summary: Mapped["Summary | None"] = relationship(
        cascade="all, delete-orphan", passive_deletes=True
    )
    chapters: Mapped[list["Chapter"]] = relationship(
        cascade="all, delete-orphan", passive_deletes=True, order_by="Chapter.position"
    )
    action_items: Mapped[list["ActionItem"]] = relationship(
        back_populates="meeting", cascade="all, delete-orphan", passive_deletes=True,
        order_by="ActionItem.id",
    )
    soundbites: Mapped[list["Soundbite"]] = relationship(
        cascade="all, delete-orphan", passive_deletes=True, order_by="Soundbite.start_sec"
    )
    bookmarks: Mapped[list["Bookmark"]] = relationship(
        cascade="all, delete-orphan", passive_deletes=True, order_by="Bookmark.at_sec"
    )
    # Comments belong to transcript lines; this read-only view gathers them per meeting.
    comments: Mapped[list["Comment"]] = relationship(
        secondary="segments", primaryjoin="Meeting.id == Segment.meeting_id",
        secondaryjoin="Segment.id == Comment.segment_id", viewonly=True, order_by="Comment.created_at",
    )


class Speaker(Base):
    """A voice in one meeting's transcript. Optionally linked to a known participant."""
    __tablename__ = "speakers"
    __table_args__ = (UniqueConstraint("meeting_id", "name"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    meeting_id: Mapped[int] = mapped_column(ForeignKey("meetings.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(120))
    participant_id: Mapped[int | None] = mapped_column(
        ForeignKey("participants.id", ondelete="SET NULL")
    )

    meeting: Mapped[Meeting] = relationship(back_populates="speakers")


class Segment(Base):
    """One transcript line. start_sec/end_sec drive click-to-seek and playback highlighting."""
    __tablename__ = "segments"
    __table_args__ = (Index("ix_segments_meeting_position", "meeting_id", "position"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    meeting_id: Mapped[int] = mapped_column(ForeignKey("meetings.id", ondelete="CASCADE"))
    speaker_id: Mapped[int] = mapped_column(ForeignKey("speakers.id", ondelete="CASCADE"))
    position: Mapped[int] = mapped_column(Integer)
    start_sec: Mapped[float] = mapped_column(Float)
    end_sec: Mapped[float] = mapped_column(Float)
    text: Mapped[str] = mapped_column(Text)

    meeting: Mapped[Meeting] = relationship(back_populates="segments")
    speaker: Mapped[Speaker] = relationship()


class Summary(Base):
    __tablename__ = "summaries"

    meeting_id: Mapped[int] = mapped_column(
        ForeignKey("meetings.id", ondelete="CASCADE"), primary_key=True
    )
    overview: Mapped[str] = mapped_column(Text)
    # Where the notes came from: "seed", "ai" (Groq LLM) or "heuristic" (offline fallback).
    source: Mapped[str] = mapped_column(String(20))
    generated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class Chapter(Base):
    """Outline entry. start_sec lets the user jump the player to where the topic begins."""
    __tablename__ = "chapters"

    id: Mapped[int] = mapped_column(primary_key=True)
    meeting_id: Mapped[int] = mapped_column(ForeignKey("meetings.id", ondelete="CASCADE"), index=True)
    position: Mapped[int] = mapped_column(Integer)
    title: Mapped[str] = mapped_column(String(255))
    summary: Mapped[str] = mapped_column(Text, default="")
    start_sec: Mapped[float] = mapped_column(Float, default=0)


class ActionItem(Base):
    __tablename__ = "action_items"

    id: Mapped[int] = mapped_column(primary_key=True)
    meeting_id: Mapped[int] = mapped_column(ForeignKey("meetings.id", ondelete="CASCADE"), index=True)
    text: Mapped[str] = mapped_column(Text)
    assignee_id: Mapped[int | None] = mapped_column(
        ForeignKey("participants.id", ondelete="SET NULL")
    )
    is_completed: Mapped[bool] = mapped_column(Boolean, default=False)
    # Where in the recording the task was mentioned; null for manually added items.
    start_sec: Mapped[float | None] = mapped_column(Float)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    meeting: Mapped[Meeting] = relationship(back_populates="action_items")
    assignee: Mapped[Participant | None] = relationship()


class Comment(Base):
    """A comment pinned to a transcript line (Fireflies' Comments panel)."""
    __tablename__ = "comments"

    id: Mapped[int] = mapped_column(primary_key=True)
    segment_id: Mapped[int] = mapped_column(ForeignKey("segments.id", ondelete="CASCADE"), index=True)
    body: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    segment: Mapped[Segment] = relationship()


class Soundbite(Base):
    """A named clip of the recording, from start_sec to end_sec."""
    __tablename__ = "soundbites"

    id: Mapped[int] = mapped_column(primary_key=True)
    meeting_id: Mapped[int] = mapped_column(ForeignKey("meetings.id", ondelete="CASCADE"), index=True)
    title: Mapped[str] = mapped_column(String(255))
    start_sec: Mapped[float] = mapped_column(Float)
    end_sec: Mapped[float] = mapped_column(Float)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class Bookmark(Base):
    """A one-click marker at a moment: important / action / positive / negative."""
    __tablename__ = "bookmarks"

    id: Mapped[int] = mapped_column(primary_key=True)
    meeting_id: Mapped[int] = mapped_column(ForeignKey("meetings.id", ondelete="CASCADE"), index=True)
    kind: Mapped[str] = mapped_column(String(20))
    at_sec: Mapped[float] = mapped_column(Float)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class TopicTracker(Base):
    """A named set of keywords tracked across meetings (Fireflies' Topic Trackers)."""
    __tablename__ = "topic_trackers"

    id: Mapped[int] = mapped_column(primary_key=True)
    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(80))
    # Comma-separated, lower-cased. A tracker has a handful of keywords that are always read
    # together, so a child table would add joins without enabling any query we need.
    keywords: Mapped[str] = mapped_column(Text)
