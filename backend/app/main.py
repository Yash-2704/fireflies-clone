import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.db import Base, engine
from app.routers import action_items, meetings, search

Base.metadata.create_all(engine)

app = FastAPI(title="Fireflies Clone API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",")],
    allow_methods=["*"],
    allow_headers=["*"],
)

for r in (meetings.router, action_items.router, search.router):
    app.include_router(r, prefix="/api")


@app.get("/health")
def health():
    return {"status": "ok"}
