# Fireflies.ai Clone — Meeting Notes & Transcription

**Live demo:** https://frontend-production-013d.up.railway.app · **API:** https://backend-production-1f14.up.railway.app/docs

A full-stack clone of the Fireflies.ai meeting workspace: a meetings library, an interactive
transcript synced to a player, AI-generated notes (overview, timestamped outline, action items),
AskFred Q&A, global search and task tracking.

| Layer | Stack |
|---|---|
| Frontend | Next.js 16 (App Router, TypeScript), Tailwind CSS v4, lucide-react |
| Backend | Python, FastAPI, SQLAlchemy 2, Pydantic v2 |
| Database | SQLite |
| AI | Groq API — `openai/gpt-oss-120b` for notes/AskFred (reliable strict-JSON output), `whisper-large-v3` for transcribing uploaded recordings, with an offline fallback for notes |
| Hosting | Railway (two services; SQLite + recordings on a persistent volume) |

## Setup

**Backend** (Python 3.11+)

```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env          # add your GROQ_KEYS (comma-separated); optional
python -m app.seed            # creates data/fireflies.db with 6 sample meetings
uvicorn app.main:app --reload --port 8000
```

API docs: http://localhost:8000/docs · Tests: `pytest`

**Frontend** (Node 20+)

```bash
cd frontend
cp .env.example .env.local    # NEXT_PUBLIC_API_URL=http://localhost:8000
npm install
npm run dev                   # http://localhost:3000
```

Without Groq keys everything still works: new notes and AskFred answers come from a heuristic
fallback, and the UI labels them "Auto-generated (AI offline)".

## Features

- **Meetings library** — grouped by day, search by title/participant, Filters popover
  (participants, date range, duration, tags), sort by recency, tags shown as channels.
- **Meeting detail** — three columns like Fireflies:
  - *Smart Search*: AI filter chips (Questions, Tasks, Metrics, Dates) and speaker talk-time
    (talk %, words per minute). Clicking one filters the transcript.
  - *Notes*: overview, outline with clickable timestamps, action items grouped by owner.
  - *Transcript / AskFred* tabs.
  - A player bar pinned to the bottom (play/pause, ±15s, speed, seek).
- **Transcript ↔ player sync** — click a line, outline entry, action item or AskFred citation to
  seek; during playback the active line highlights and auto-scrolls. Scrolling away shows
  "Sync with audio".
- **Find in transcript** — highlighted matches with an "n of N" counter and ↑/↓ (Enter / Shift+Enter).
- **Upload recordings** — MP3, M4A, WAV, MP4, WEBM (≤ 25 MB) are transcribed with Groq Whisper into
  timestamped segments, then notes are generated. Whisper has no speaker diarization, so lines start
  as "Speaker 1" (as in Fireflies) and can be renamed. Video recordings play inline.
- **Sample meetings have real audio** — generated once with Groq Orpheus TTS (a consistent voice per
  speaker) by `backend/scripts/make_seed_audio.py`, which also rebuilt the seed timestamps from the
  real clip lengths so transcript and audio stay in sync.
- **CRUD** — create a meeting by uploading a recording or a transcript file (.txt, .vtt, .srt, .json), or pasting a transcript; edit
  title/participants/tags; delete; add, edit inline, reassign, complete and delete action items;
  rename speakers ("Speaker 1" → a real name, linked as a participant); regenerate notes.
- **AskFred** — chat about a meeting (Groq), with clickable timestamp citations, copy and 👍/👎 on answers,
  and quick-ask chips. **Across meetings** too: on Home and in the library (scoped to the selected
  channel), answering from recent meetings' summaries and action items, with links to cited meetings.
- **Soundbites, comments and bookmarks** — select transcript text to get a toolbar (Create soundbite ·
  Comment · Bookmark · Copy). Left mini-rail panels list soundbites (plays just that clip), comments
  (quoting their line) and typed bookmarks (Important / Action item / Positive / Negative, filterable).
  The player bar has one-click ☆ ☑ 👍 👎 bookmarks and timeline ticks.
- **Transcript tools** — edit a line (fix Whisper mistakes), copy a link to a moment (`?t=`), rename speakers.
- **Shell** — profile menu (theme toggle), notifications built from real events (notes ready, your open
  action items) with unread state, and a Capture menu (upload, paste, schedule, live).
- **Global search (⌘K)** — titles and transcript lines, jumping straight to the moment.
- **Tasks page** — every action item across meetings, with open/completed filters.
- **Export** — notes as Markdown, transcript as TXT (re-importable), or print/save as PDF.
- **Dark theme by default** (like Fireflies), light theme in Settings. Toasts for every action.
- Placeholders ("Coming soon"): live capture bot, integrations, team, analytics, AI skills,
  voice agents, billing, and recording settings.

## Architecture

```
frontend (Next.js, client components)            backend (FastAPI)
  app/ pages ──► lib/api.ts (typed fetch) ──HTTP──► routers/   meetings · action_items · search
  components/                                        services/  meetings  (build/serialize, speaker stats)
    shell/    rail, top bar, ⌘K search                          transcript_parser (txt/vtt/srt/json)
    library/  rows, filters, create/edit modals                 ai (Groq client + heuristic fallback)
    meeting/  notes, transcript, AskFred, player      models.py (SQLAlchemy) ─► SQLite
```

- **The backend owns ingestion.** Uploaded and pasted transcripts are parsed server-side into timed
  segments. Speakers are created, and speakers with real names are added as participants. Notes are
  then generated in the same request.
- **Notes generation.** One Groq call in JSON mode returns `{overview, chapters[], action_items[]}`,
  each item with an `mm:ss` start taken from real transcript lines. Groq keys are rotated on
  rate limits and errors. If every key fails, a deterministic heuristic produces notes instead,
  and `summaries.source` records which path was used.
- **Player.** One `<audio>`/`<video>` element per meeting drives time (seek, speed, ±15s, transcript
  sync). The backend serves recordings with HTTP Range support, so seeking works. Meetings created
  from pasted text have no media, so the same player API falls back to a clock over the transcript timeline.
- **Auth** is a placeholder, per the brief. Every request acts as the seeded default user, and
  every query is scoped to `organizer_id`, so real auth can later replace one dependency
  (`current_user`).

## Database schema

```
users 1─N meetings N─M participants   (meeting_participants)
                   N─M tags           (meeting_tags)
          meetings 1─N speakers ─N:1 participants (nullable)
          meetings 1─N segments  N─1 speakers
          meetings 1─1 summaries
          meetings 1─N chapters
          meetings 1─N action_items ─N:1 participants (assignee, nullable)
          meetings 1─N soundbites, bookmarks
          segments 1─N comments
```

| Table | Key columns | Why |
|---|---|---|
| users | name, email | The organizer. Meetings are scoped to it. |
| participants | name (unique), email | Shared across meetings, which enables filtering by attendee. |
| meetings | title, date (indexed), duration_sec, organizer_id, media_path?, media_type? | Library list, sort and filters. media_* point at the recording (null for text-only meetings). |
| speakers | meeting_id, name, participant_id? | A voice in one transcript. Unique per meeting. Renaming links it to a participant. |
| segments | meeting_id, speaker_id, position, start_sec, end_sec, text | Transcript lines. The times drive seeking, highlighting and talk-time. |
| summaries | meeting_id (PK), overview, source, generated_at | 1:1 with a meeting. `source` = seed/ai/heuristic. |
| chapters | meeting_id, position, title, summary, start_sec | Outline entries that jump to where each topic starts. |
| action_items | meeting_id, text, assignee_id?, is_completed, start_sec? | Tasks. `start_sec` = where the task was said (null if added manually). |
| tags / meeting_tags | name | Labels and channels for filtering. |
| comments | segment_id, body, created_at | A discussion note pinned to a transcript line (deleted with the line/meeting). |
| soundbites | meeting_id, title, start_sec, end_sec | A named clip; the player plays just that range. |
| bookmarks | meeting_id, kind, at_sec | One-click markers: important / action / positive / negative. |

Every child table uses `ON DELETE CASCADE` (with SQLite foreign keys enabled), so deleting a
meeting removes its whole tree. Talk-time and words per minute are **derived** from segments when
a meeting is read, not stored, so they can never go stale after a speaker is renamed.

## API

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/meetings?q=&participant_id=&tag=&date_from=&date_to=&min_duration=&max_duration=&sort=recent\|oldest` | List and filter meetings |
| POST | `/api/meetings` (multipart: `title, date, participants, tags, transcript_text \| file`) | Create from a recording (Whisper) or transcript, then generate notes |
| GET | `/media/{file}` | Recording file (Range requests supported) |
| GET / PATCH / DELETE | `/api/meetings/{id}` | Detail (speakers with stats, segments, summary, chapters, action items) / edit / delete |
| POST | `/api/meetings/{id}/notes` | Regenerate notes |
| PATCH | `/api/meetings/{id}/speakers/{speaker_id}` | Rename a speaker |
| POST | `/api/meetings/{id}/ask` | AskFred `{question, history}` |
| POST | `/api/meetings/{id}/action-items` | Add an action item |
| PATCH / DELETE | `/api/action-items/{id}` | Edit / complete / reassign / delete |
| GET | `/api/action-items?status=open\|done\|all` | Tasks across meetings |
| GET | `/api/search?q=` | Global search (titles and transcript lines, with timestamps) |
| POST | `/api/ask` `{question, history, tag?}` | AskFred across recent meetings (optionally one channel/tag) |
| GET | `/api/notifications` | Activity feed derived from meetings and open action items |
| POST / DELETE | `/api/meetings/{id}/comments`, `/api/comments/{id}` | Comment on a transcript line |
| POST / DELETE | `/api/meetings/{id}/soundbites`, `/api/soundbites/{id}` | Create / delete a clip |
| POST / DELETE | `/api/meetings/{id}/bookmarks`, `/api/bookmarks/{id}` | Add / remove a bookmark |
| PATCH | `/api/segments/{id}` | Edit a transcript line's text |
| GET | `/api/participants`, `/api/tags`, `/api/me` | Filter options, current user |

## Deployment (Railway)

Two services from this repo. `backend/` (Railpack, start command in `railpack.json`) has a volume
mounted at `/data` with `DATA_DIR=/data`, `GROQ_KEYS` and `CORS_ORIGINS=<frontend URL>`.
`frontend/` has `NEXT_PUBLIC_API_URL=<backend URL>`, which is set at build time. On first boot the
backend seeds the sample meetings (it never reseeds a database that already has data).

```bash
railway up ./backend --path-as-root --service backend
railway up ./frontend --path-as-root --service frontend
```

## Assumptions

- Live recording and a bot that joins calls are out of scope. Recordings are uploaded, and Whisper
  transcribes them without speaker separation.
- A transcript line without a timestamp gets an estimated one (about 150 words per minute), so
  every line can still be seeked.
- Very long transcripts are truncated to about 18k characters before the LLM call, because of
  Groq's free-tier tokens-per-minute limit.
- There is one default user (auth is out of scope).
