"""Reset the database and load sample meetings: python -m app.seed"""

from datetime import datetime, timedelta

from app.db import Base, SessionLocal, engine
from app.models import Meeting, User
from app.seed_data import MEETINGS
from app.services.ai import normalize_notes
from app.services.meetings import apply_notes, load_transcript, participants_by_name, tags_by_name
from app.services.transcript_parser import parse_transcript


def seed() -> None:
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    today = datetime.now().replace(minute=0, second=0, microsecond=0)
    with SessionLocal() as db:
        user = User(name="Yash Aggarwal", email="yash@example.com")
        db.add(user)
        for data in MEETINGS:
            meeting = Meeting(
                title=data["title"], organizer=user,
                date=(today - timedelta(days=data["days_ago"])).replace(hour=data["hour"]),
            )
            meeting.participants = participants_by_name(db, data["participants"])
            meeting.tags = tags_by_name(db, data["tags"])
            db.add(meeting)
            load_transcript(db, meeting, parse_transcript(data["transcript"]))
            apply_notes(db, meeting, normalize_notes(data["notes"]), "seed")
        db.commit()
    print(f"Seeded {len(MEETINGS)} meetings")


if __name__ == "__main__":
    seed()
