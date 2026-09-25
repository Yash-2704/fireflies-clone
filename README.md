# Fireflies.ai Clone — Meeting Notes & Transcription

A full-stack clone of the Fireflies.ai meeting workspace. You can browse a meetings library, play
recordings with an interactive transcript that stays in sync, read AI notes (overview, timestamped
outline, action items), ask AskFred about one meeting or all of them, clip soundbites, comment,
bookmark, and see team analytics.

| | |
|---|---|
| **Live app** | https://frontend-production-013d.up.railway.app |
| **API** | https://backend-production-1f14.up.railway.app (interactive docs at [`/docs`](https://backend-production-1f14.up.railway.app/docs)) |
| **Source** | https://github.com/Yash-2704/fireflies-clone |

The demo opens with six sample meetings, and each one has real multi-voice audio. They also come
with notes, action items, soundbites, comments, bookmarks and topic trackers, so every feature is
visible straight away.

---

## Feature status

### ✅ Live and working

**Meetings library**
- Meetings grouped by day, each showing title, date, duration, organizer, participants and tags.
- Search by title or participant. The Filters menu covers participants, date range, duration and tags.
- Sort by most recent or oldest. Tags also appear as channels in the sidebar.
- Row menu with Copy link, Download notes (Markdown), Rename / edit, and Delete (with confirmation).

**Creating meetings**
- **Upload:** audio or video (MP3, M4A, WAV, MP4, WEBM, up to 100 MB).
  - The server extracts the speech audio with ffmpeg, and Groq Whisper transcribes it with timestamps.
  - Transcript files (TXT, VTT, SRT, JSON) are parsed with their timestamps kept.
- **Paste a transcript:** a form with title, transcript, participants, date and tags.
- After either one, the LLM writes the overview, a timestamped outline and action items with owners.

**Meeting page** (three columns, like Fireflies)
- Real audio or video playback. The player bar has play/pause, ±15 s, 0.75×–3× speed and a seek bar.
- **Transcript and player stay in sync.** Clicking any line, outline entry, action item, comment,
  bookmark or AskFred citation jumps the player there. During playback the active line is
  highlighted and scrolled into view, and a "Sync with audio" button appears if you scroll away.
- Find in transcript, with highlighted matches, an "n of N" counter and ↑/↓.
- Rename speakers (for example "Speaker 1" → a real name, who is then added as a participant),
  edit a transcript line, and copy a link to any moment.
- **Notes:** overview, outline with timestamps, and action items grouped by owner. Action items can
  be edited inline, reassigned, completed, added and deleted. Notes can be regenerated with AI.
- **Smart Search panel:**
  - AI filters (Questions, Tasks, Metrics, Dates & Times).
  - Topic tracker mention counts.
  - Speaker talk time (share and words per minute). Clicking any of these filters the transcript.
- **Soundbites:** select transcript text and choose "Create soundbite". Playing one plays only that clip.
- **Comments:** on any transcript line, either from the selection toolbar or the Comments panel.
- **Bookmarks:** Important / Action item / Positive / Negative. Add them from the player bar (at the
  current moment) or from a text selection. They can be filtered in the Bookmarks panel.
- **AskFred:** chat about the meeting, with clickable timestamp citations, copy and 👍/👎 on answers,
  and quick prompts.
- Share dialog with a copyable link, optionally starting at the current moment. Inline title rename.
- Export notes as Markdown or the transcript as TXT, or print / save as PDF.

**Across the workspace**
- **AskFred across meetings** on Home, and in the library limited to the selected channel. Cited
  meetings are linked.
- **Global search (⌘K / Ctrl+K)** over meeting titles and transcript lines. Results jump to the exact moment.
- **Tasks:** every action item across meetings, with Open / Completed / All tabs.
- **Analytics → Team Insights:**
  - Metrics: conversations, time in conversations, questions asked, filler words, monologues,
    longest monologue, your talk-to-listen ratio, words per minute, and silence.
  - Each metric shows ▲/▼ against the previous period of the same length.
  - A per-day chart (hover for details, or switch to a table), a speakers table, and CSV export.
  - Date range can be Today / 7 days / 30 days / custom, filtered by channel and participants.
  - Each card's ⓘ explains how the metric is measured.
- **Analytics → Topic Insights:** topic trackers (keyword sets) showing conversations and mentions
  per keyword. Clicking a keyword opens search. Trackers can be created and deleted.
- **Home:** time-of-day greeting, assistant cards, Recent / Upcoming / My Tasks tabs, and AskFred.
- **Notifications** built from real events (notes ready, your open action items), with unread state.
- **Profile menu:** a light/dark theme toggle (dark by default, like Fireflies) and a Settings link.
- Toasts for every action, keyboard-accessible menus, and responsive layouts (tablet: panels open as
  overlays; phone: tabs).

### 🕒 Coming soon (placeholders that say so)

| Area | What happens today |
|---|---|
| Live capture: a notetaker bot joining Zoom / Meet / Teams | "Coming soon" page (Capture → Add to live meeting) |
| Calendar sync and scheduling | Capture → Schedule shows a coming-soon toast; the Home "Upcoming" tab explains it |
| Integrations (Zoom, Google Meet, calendar, CRM) | "Coming soon" page |
| Team and sharing with teammates | The Share dialog's invite box and the Team page are placeholders (link sharing works) |
| AI Skills and Voice Agents | "Coming soon" pages |
| Recording settings (auto-record, language, retention, email recaps) | Settings rows marked "Coming soon" (the theme setting works) |
| Authentication | Everyone uses a default demo user; "Log out" explains this |

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16 (App Router, TypeScript), Tailwind CSS v4, lucide-react icons |
| Backend | Python 3.12, FastAPI, SQLAlchemy 2, Pydantic v2, Uvicorn |
| Database | SQLite, with recordings stored alongside it |
| AI | Groq: `openai/gpt-oss-120b` (notes and AskFred, JSON mode) and `whisper-large-v3` (speech-to-text) |
| Media | ffmpeg (extracts compact speech audio from uploads before transcription) |
| Hosting | Railway: two services, with the SQLite database and recordings on a persistent volume |

## Architecture

```
Next.js (client components)                       FastAPI
  app/ pages                                        routers/
  components/                                         meetings       list · CRUD · upload · notes · ask
    shell/     rail, top bar, search, menus           action_items   tasks
    library/   rows, filters, upload/create modals    annotations    comments · soundbites · bookmarks · line edits
    meeting/   notes, transcript, AskFred,            analytics      team insights · topic insights · topics
               player, annotation panels              search         global search · workspace ask · notifications
    analytics/ stat cards, chart, topics            services/
  lib/api.ts   typed fetch client ───── HTTP ────▶    transcript_parser   txt / vtt / srt / json → timed segments
                                                      ai                  Groq notes, Q&A, Whisper; offline fallback
                                                      analytics           metrics from segments
                                                      meetings            build, serialize, speaker stats
                                                    models.py (SQLAlchemy) ──▶ SQLite  +  media/ (recordings)
```

- **The backend owns ingestion.** An upload is streamed to disk, its speech audio is extracted,
  and Whisper returns timestamped segments. Transcript files are parsed instead. The backend then
  creates speakers and segments and generates the notes, all in one request.
- **Notes** come from a single Groq call in JSON mode: overview, chapters and action items, each
  with an `mm:ss` start taken from real lines. Keys are rotated when one hits a rate limit. If the
  AI is unavailable, a deterministic fallback writes basic notes, and `summaries.source` records
  which path was used (`ai`, `heuristic` or `seed`).
- **Playback.** One `<audio>`/`<video>` element per meeting drives time, and the backend serves
  recordings with HTTP Range support so seeking works. Meetings created from pasted text have no
  media, so the same player falls back to a clock over the transcript timeline.
- **Analytics** are calculated from transcript segments on every request, so speaker renames and
  transcript edits show up immediately.
- **Auth** is a placeholder. Every route resolves a default user through one dependency
  (`current_user`), and every query is limited to that user's meetings, so real auth only needs to
  replace that dependency.

## Database schema

```
users 1─N meetings N─M participants   (meeting_participants)
                   N─M tags           (meeting_tags)
      1─N topic_trackers
meetings 1─N speakers ─N:1 participants (nullable)
         1─N segments N─1 speakers      segments 1─N comments
         1─1 summaries
         1─N chapters
         1─N action_items ─N:1 participants (assignee, nullable)
         1─N soundbites
         1─N bookmarks
```

| Table | Key columns | Purpose |
|---|---|---|
| `users` | name, email | The workspace owner. All data is limited to this user. |
| `participants` | name (unique), email | People, shared across meetings, which enables filtering by attendee. |
| `meetings` | title, date (indexed), duration_sec, organizer_id, media_path?, media_type? | A meeting. `media_*` point to the recording (null for pasted transcripts). |
| `meeting_participants`, `meeting_tags` | join tables | Many-to-many links. |
| `tags` | name (unique) | Labels, shown as channels. |
| `speakers` | meeting_id, name, participant_id? | A voice in one transcript. Unique per meeting. Renaming links it to a participant. |
| `segments` | meeting_id, speaker_id, position, start_sec, end_sec, text | Transcript lines. The times drive seeking, highlighting and analytics. |
| `summaries` | meeting_id (PK), overview, source, generated_at | 1:1 AI overview, recording where it came from. |
| `chapters` | meeting_id, position, title, summary, start_sec | Outline entries that jump the player. |
| `action_items` | meeting_id, text, assignee_id?, is_completed, start_sec? | Tasks. `start_sec` is where the task was said (null if added by hand). |
| `comments` | segment_id, body, created_at | A comment pinned to a transcript line. |
| `soundbites` | meeting_id, title, start_sec, end_sec | A named clip. |
| `bookmarks` | meeting_id, kind, at_sec | important / action / positive / negative. |
| `topic_trackers` | owner_id, name, keywords | Keyword sets tracked across meetings. |

Foreign keys are enforced (SQLite `PRAGMA foreign_keys=ON`), and child rows use `ON DELETE CASCADE`,
so deleting a meeting removes its whole tree. The recording file is deleted too. Talk time, words per
minute and every analytics metric are **derived** from segments rather than stored, so they can't go stale.

## API overview

All routes are under `/api`. The full interactive reference is at [`/docs`](https://backend-production-1f14.up.railway.app/docs).

| Method | Path | Purpose |
|---|---|---|
| GET | `/meetings?q=&participant_id=&tag=&date_from=&date_to=&min_duration=&max_duration=&sort=` | List and filter meetings |
| POST | `/meetings` (multipart: `file` or `transcript_text`, plus `title, date, participants, tags`) | Create from a recording, a transcript file or pasted text, then generate notes |
| GET / PATCH / DELETE | `/meetings/{id}` | Full detail / edit title, date, participants, tags / delete |
| POST | `/meetings/{id}/notes` | Regenerate AI notes |
| PATCH | `/meetings/{id}/speakers/{speaker_id}` | Rename a speaker |
| POST | `/meetings/{id}/ask` | AskFred about one meeting |
| POST | `/ask` | AskFred across meetings (optional `tag`) |
| POST / PATCH / DELETE | `/meetings/{id}/action-items`, `/action-items/{id}` | Action items |
| GET | `/action-items?status=open\|done\|all` | Tasks across meetings |
| POST / DELETE | `/meetings/{id}/comments`, `/comments/{id}` | Comments on transcript lines |
| POST / DELETE | `/meetings/{id}/soundbites`, `/soundbites/{id}` | Soundbites |
| POST / DELETE | `/meetings/{id}/bookmarks`, `/bookmarks/{id}` | Bookmarks |
| PATCH | `/segments/{id}` | Edit a transcript line |
| GET | `/analytics/team`, `/analytics/topics` (date, participant and tag filters) | Team and Topic Insights |
| GET / POST / DELETE | `/topics`, `/topics/{id}` | Topic trackers |
| GET | `/search?q=` | Search titles and transcripts |
| GET | `/notifications`, `/participants`, `/tags`, `/me` | Activity feed and lookups |
| GET | `/media/{file}` | Recording file (Range requests supported) |

## Setup

**Requirements:** Python 3.12, Node.js 20+, ffmpeg (for audio/video uploads), and a Groq API key
(optional; without one, notes and AskFred use a basic offline fallback, but recordings can't be transcribed).

**Backend** (from `backend/`):

```bash
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env          # set GROQ_KEYS (comma-separated keys) and CORS_ORIGINS (the frontend's URL)
python -m app.seed            # sample meetings, audio and annotations
uvicorn app.main:app --port 8000
pytest                        # 11 API tests
```

**Frontend** (from `frontend/`):

```bash
npm install
cp .env.example .env.local    # set NEXT_PUBLIC_API_URL to the backend's URL
npm run dev                   # or: npm run build && npm start
```

**Environment variables**

| Service | Variable | Meaning |
|---|---|---|
| backend | `GROQ_KEYS` | Comma-separated Groq API keys (rotated on rate limits) |
| backend | `GROQ_MODEL` | Defaults to `openai/gpt-oss-120b` |
| backend | `CORS_ORIGINS` | Allowed frontend origin(s), comma-separated |
| backend | `DATA_DIR` | Where the SQLite file and recordings live (a volume in production) |
| backend | `RESEED_ON_BOOT` | Set to `1` for one deploy to reset a hosted demo to the sample data |
| frontend | `NEXT_PUBLIC_API_URL` | The backend's public URL (read at build time) |

**Deployment (Railway):** two services built from this repo with Railpack. `backend/railpack.json`
installs ffmpeg and sets the start command, and the backend has a volume mounted at `/data`
(`DATA_DIR=/data`). On first boot with an empty volume, the backend seeds the sample data itself.

```bash
railway up ./backend --path-as-root --service backend
railway up ./frontend --path-as-root --service frontend
```

The sample audio was generated once with Groq Orpheus text-to-speech (a consistent voice per
speaker) by `backend/scripts/make_seed_audio.py`. That script also rebuilt the transcript and note
timestamps from the real clip lengths, so audio and transcript stay aligned.

## Assumptions

- **Authentication** is out of scope. The app acts as a single default user, and every query is
  limited to that user, so real auth can be added later.
- **Live recording** isn't included. Recordings are uploaded, and Whisper transcribes them **without
  telling speakers apart**, so uploaded recordings start as "Speaker 1" and can be renamed (Fireflies
  does the same).
- **Transcript lines without timestamps** (pasted text) get estimated times (about 150 words per
  minute), so every line can still be seeked.
- **Long meetings.** The notes prompt is capped at about 18k characters of transcript, because of
  Groq's free-tier limit on tokens per minute.
- **Metric definitions:**
  - a monologue is 30 s or more by one speaker without interruption;
  - silence is a gap of 1 s or more between lines;
  - a question is a "?" in a line;
  - filler words come from a fixed list (um, uh, you know, basically…).
  - Sentiment is not computed, since there is no reliable source for it.
- **Uploads** are limited to 100 MB. The extracted speech audio sent to Whisper stays under its 25 MB limit.
- **SQLite** suits a single-instance demo. Moving to Postgres would only mean changing `DATABASE_URL`.
