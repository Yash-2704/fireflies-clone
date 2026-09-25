import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from sqlalchemy import select

from app.db import MEDIA_DIR, Base, SessionLocal, engine
from app.models import User
from app.routers import action_items, meetings, search
from app.seed import seed

Base.metadata.create_all(engine)

# First boot on a fresh volume: load the sample meetings so the demo is usable immediately.
with SessionLocal() as _db:
    if _db.scalar(select(User.id).limit(1)) is None:
        seed()

app = FastAPI(title="Fireflies Clone API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",")],
    allow_methods=["*"],
    allow_headers=["*"],
)

for r in (meetings.router, action_items.router, search.router):
    app.include_router(r, prefix="/api")


# Recordings (supports HTTP Range requests, which <audio>/<video> seeking relies on).
app.mount("/media", StaticFiles(directory=MEDIA_DIR), name="media")


@app.get("/health")
def health():
    return {"status": "ok"}
