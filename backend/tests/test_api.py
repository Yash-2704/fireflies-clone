import os
import tempfile

os.environ["DATABASE_URL"] = f"sqlite:///{tempfile.mkdtemp()}/test.db"
os.environ["GROQ_KEYS"] = ""  # offline heuristic path: deterministic, no network

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.seed import seed

c = TestClient(app)


@pytest.fixture(autouse=True)
def fresh_db():
    seed()


def test_list_filter_sort():
    all_ = c.get("/api/meetings").json()["meetings"]
    assert len(all_) == 6
    assert [m["date"] for m in all_] == sorted((m["date"] for m in all_), reverse=True)
    assert c.get("/api/meetings", params={"q": "olivia"}).json()["total"] == 1  # by participant
    assert c.get("/api/meetings", params={"q": "standup"}).json()["total"] == 1  # by title
    assert c.get("/api/meetings", params={"tag": "design"}).json()["total"] == 1
    oldest = c.get("/api/meetings", params={"sort": "oldest"}).json()["meetings"]
    assert oldest[0]["id"] == all_[-1]["id"]


def test_create_from_pasted_transcript_generates_notes():
    r = c.post("/api/meetings", data={
        "title": "Budget review", "participants": "Zoe Park",
        "transcript_text": "[00:00] Zoe Park: Let's review the budget.\n[00:20] Sam Lee: I'll send the numbers by Friday.",
    })
    assert r.status_code == 201, r.text
    m = r.json()
    assert m["duration_sec"] > 20
    assert {p["name"] for p in m["participants"]} == {"Zoe Park", "Sam Lee"}  # speakers join participants
    assert m["summary"]["source"] == "heuristic"
    assert m["action_items"][0]["assignee"]["name"] == "Sam Lee"
    assert m["action_items"][0]["start_sec"] == 20


def test_upload_vtt_and_bad_input():
    vtt = b"WEBVTT\n\n00:00:01.000 --> 00:00:03.000\n<v Ana>Hello</v>\n"
    r = c.post("/api/meetings", files={"file": ("call.vtt", vtt, "text/vtt")})
    assert r.status_code == 201 and r.json()["title"] == "call"
    assert r.json()["segments"][0]["start_sec"] == 1
    assert c.post("/api/meetings", data={"transcript_text": "  "}).status_code == 422


def test_edit_rename_speaker_and_delete():
    m = c.patch("/api/meetings/1", json={"title": "Renamed", "participants": ["A B"]}).json()
    assert m["title"] == "Renamed" and [p["name"] for p in m["participants"]] == ["A B"]
    sp = m["speakers"][0]
    m = c.patch(f"/api/meetings/1/speakers/{sp['id']}", json={"name": "New Name"}).json()
    assert any(s["name"] == "New Name" for s in m["speakers"])
    assert c.delete("/api/meetings/1").status_code == 204
    assert c.get("/api/meetings/1").status_code == 404
    assert all(t["meeting_id"] != 1 for t in c.get("/api/action-items").json())  # cascade


def test_action_item_crud():
    m = c.get("/api/meetings/2").json()
    outsider = c.get("/api/meetings/3").json()["participants"][0]["id"]
    assert c.post("/api/meetings/2/action-items", json={"text": "x", "assignee_id": outsider}).status_code == 422
    item = c.post("/api/meetings/2/action-items",
                  json={"text": "Follow up", "assignee_id": m["participants"][0]["id"]}).json()
    done = c.patch(f"/api/action-items/{item['id']}", json={"is_completed": True, "text": "Follow up now"}).json()
    assert done["is_completed"] and done["text"] == "Follow up now"
    assert item["id"] in [t["id"] for t in c.get("/api/action-items", params={"status": "done"}).json()]
    assert c.delete(f"/api/action-items/{item['id']}").status_code == 204


def test_regenerate_keeps_manual_and_completed_items():
    manual = c.post("/api/meetings/3/action-items", json={"text": "Manual task"}).json()
    m = c.post("/api/meetings/3/notes").json()
    assert manual["id"] in [a["id"] for a in m["action_items"]]
    assert m["summary"]["source"] == "heuristic"


def test_search_and_ask_offline():
    hits = c.get("/api/search", params={"q": "hubspot"}).json()
    assert hits and hits[0]["kind"] == "transcript" and hits[0]["start_sec"] is not None
    r = c.post("/api/meetings/2/ask", json={"question": "what about hubspot?"}).json()
    assert r["source"] == "heuristic" and "HubSpot" in r["answer"]


def test_annotations_lifecycle():
    m = c.get("/api/meetings/1").json()
    seg = m["segments"][3]
    comment = c.post("/api/meetings/1/comments", json={"segment_id": seg["id"], "body": "Good point"}).json()
    other_seg = c.get("/api/meetings/2").json()["segments"][0]["id"]
    assert c.post("/api/meetings/1/comments", json={"segment_id": other_seg, "body": "x"}).status_code == 422
    clip = c.post("/api/meetings/1/soundbites", json={"title": "Pricing", "start_sec": 10, "end_sec": 20}).json()
    assert c.post("/api/meetings/1/soundbites", json={"title": "bad", "start_sec": 20, "end_sec": 10}).status_code == 422
    mark = c.post("/api/meetings/1/bookmarks", json={"kind": "action", "at_sec": 12}).json()
    assert c.post("/api/meetings/1/bookmarks", json={"kind": "nope", "at_sec": 1}).status_code == 422
    m = c.get("/api/meetings/1").json()
    assert [x["id"] for x in m["comments"]] == [comment["id"]]
    assert m["soundbites"][0]["title"] == "Pricing" and m["bookmarks"][0]["kind"] == "action"
    edited = c.patch(f"/api/segments/{seg['id']}", json={"text": "  Fixed   text "}).json()
    assert edited["text"] == "Fixed text"
    for path in (f"/api/comments/{comment['id']}", f"/api/soundbites/{clip['id']}", f"/api/bookmarks/{mark['id']}"):
        assert c.delete(path).status_code == 204
        assert c.delete(path).status_code == 404
    c.post("/api/meetings/1/comments", json={"segment_id": seg["id"], "body": "cascade me"})
    c.delete("/api/meetings/1")  # deleting the meeting removes its annotations too
    assert c.delete(f"/api/comments/{comment['id'] + 1}").status_code == 404


def test_workspace_ask_and_notifications_offline():
    r = c.post("/api/ask", json={"question": "anything about hubspot?"}).json()
    assert r["source"] == "heuristic" and "HubSpot" in r["answer"]
    feed = c.get("/api/notifications").json()
    assert feed[0]["kind"] in {"notes_ready", "tasks_due"}
    assert any(n["kind"] == "tasks_due" for n in feed)  # seed assigns tasks to the default user


def test_analytics_and_topics():
    week = c.get("/api/analytics/team").json()  # default: last 7 days
    month = c.get("/api/analytics/team", params={"date_from": "2000-01-01T00:00:00"}).json()
    assert 0 < week["current"]["conversations"] < month["current"]["conversations"] == 6
    cur = month["current"]
    assert cur["questions"] > 0 and cur["wpm"] > 0 and cur["duration_sec"] > 0
    assert cur["talk_pct"] is not None and 0 < cur["talk_pct"] < 100  # the default user speaks in seeds
    assert {s["name"] for s in cur["speakers"]} >= {"Olivia Chen", "Yash Aggarwal"}
    assert sum(d["meetings"] for d in month["daily"]) == 6
    assert c.get("/api/analytics/team", params={"tag": "hiring", "date_from": "2000-01-01T00:00:00"}).json()["current"]["conversations"] == 1
    assert c.get("/api/analytics/team", params={"date_from": "2030-01-01T00:00:00", "date_to": "2029-01-01T00:00:00"}).status_code == 422

    t = c.post("/api/topics", json={"name": "Hubspot", "keywords": ["HubSpot", " hubspot ", ""]}).json()
    assert t["keywords"] == ["hubspot"]
    insights = c.get("/api/analytics/topics", params={"date_from": "2000-01-01T00:00:00"}).json()
    hub = next(x for x in insights if x["id"] == t["id"])
    assert hub["conversations"] == 1 and hub["mentions"] >= 3
    assert c.delete(f"/api/topics/{t['id']}").status_code == 204
    assert c.post("/api/topics", json={"name": "x", "keywords": [" "]}).status_code == 422
