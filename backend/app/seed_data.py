"""Sample meetings. Transcripts use the same "[mm:ss] Speaker: text" format users can paste,
so seeding goes through the real transcript parser. Notes are hand-written so the demo works
instantly without calling the LLM."""

MEETINGS = [
    {
        "title": "Weekly Product Sync — Smart Notes Launch",
        "audio": "weekly-product-sync-smart-notes-launch.mp3", "days_ago": 0, "hour": 10,
        "participants": ["Priya Sharma", "Daniel Kim", "Maria Lopez", "Yash Aggarwal"],
        "tags": ["product", "launch"],
        "transcript": """
[00:00] Priya Sharma: Morning everyone. Main agenda today is the Smart Notes launch next Thursday, then a quick look at the beta feedback and whatever is blocking us.
[00:10] Daniel Kim: Sounds good. Quick status from engineering: the summarization pipeline is feature complete. We're at about ninety two percent of meetings processed in under five minutes.
[00:21] Priya Sharma: What happens to the other eight percent?
[00:25] Daniel Kim: Mostly long meetings, over ninety minutes. We chunk the transcript and merge the summaries, and the merge step is the slow part. I think we can get it down by running the chunks in parallel.
[00:37] Yash Aggarwal: Is that something we need before launch, or can it follow?
[00:41] Daniel Kim: It can follow. Long meetings are only about four percent of volume. I'd rather not touch the pipeline the week of launch.
[00:49] Priya Sharma: Agreed, let's keep it out of scope. Maria, where are we on the notes layout?
[00:55] Maria Lopez: Final designs are in Figma. The big change from the beta is that every bullet in the notes now links to the moment in the recording. Beta users kept asking "where did this come from", so the timestamp is right there.
[01:09] Yash Aggarwal: That was the number one piece of feedback in the survey, so good call.
[01:13] Maria Lopez: I also simplified the action items. They're grouped by owner now instead of one long list.
[01:21] Priya Sharma: Love it. Let's talk beta feedback. Yash, you ran the survey?
[01:27] Yash Aggarwal: Yeah, we got a hundred and forty responses. Satisfaction was 4.3 out of 5. Top complaints were timestamps, which Maria just covered, and that summaries are too long for short meetings.
[01:41] Daniel Kim: We can scale summary length with the meeting duration. That's a prompt change, maybe half a day.
[01:47] Priya Sharma: Let's do it. Daniel, can you own that?
[01:52] Daniel Kim: Yes, I'll have the length scaling done by Monday.
[01:55] Priya Sharma: Great. Any blockers for launch?
[01:59] Maria Lopez: The marketing page still has the old screenshots. I need the final build on staging to capture new ones.
[02:08] Daniel Kim: Staging will have the release candidate tomorrow afternoon.
[02:11] Maria Lopez: Then I'll update the screenshots on Friday and send them to marketing.
[02:16] Yash Aggarwal: I'll write the launch email and the changelog entry. I'll share a draft by Wednesday so everyone can review.
[02:22] Priya Sharma: Perfect. One more thing, pricing. Are we gating Smart Notes behind Pro?
[02:29] Yash Aggarwal: The proposal is free users get three smart summaries a month, unlimited on Pro. It gives people a taste without giving it all away.
[02:39] Priya Sharma: I like that. Let's go with three per month on free. I'll confirm with finance today.
[02:45] Daniel Kim: I'll need the limit as a config flag so we can tune it without a deploy.
[02:50] Priya Sharma: Makes sense. Okay, recap: launch Thursday, long meeting optimisation is post launch, Daniel on summary length, Maria on screenshots, Yash on the launch email, and I'll sort pricing with finance. Thanks all.
""",
        "notes": {
            "overview": "The team confirmed the Smart Notes launch for next Thursday. Engineering reported the summarization pipeline is feature complete, with 92% of meetings processed in under five minutes; optimising very long meetings was moved out of launch scope. Design shipped timestamped note bullets and owner-grouped action items in response to beta feedback (140 responses, 4.3/5). Free users will get three smart summaries per month, pending finance confirmation.",
            "chapters": [
                {"title": "Engineering status & long meetings", "summary": "Pipeline is feature complete; the slow merge step for 90+ minute meetings will be optimised after launch.", "start": "00:10"},
                {"title": "Notes layout redesign", "summary": "Every note bullet links to its moment in the recording, and action items are grouped by owner.", "start": "00:55"},
                {"title": "Beta survey results", "summary": "4.3/5 satisfaction. Top complaints: missing timestamps and summaries that are too long for short meetings.", "start": "01:27"},
                {"title": "Launch blockers", "summary": "Marketing screenshots need the release candidate on staging; the launch email and changelog are being drafted.", "start": "01:55"},
                {"title": "Free tier pricing", "summary": "Three smart summaries per month on free, unlimited on Pro, behind a config flag.", "start": "02:22"},
            ],
            "action_items": [
                {"text": "Scale summary length with meeting duration", "assignee": "Daniel Kim", "start": "01:52"},
                {"text": "Put the free-tier summary limit behind a config flag", "assignee": "Daniel Kim", "start": "02:45"},
                {"text": "Update marketing screenshots from staging and send them to marketing", "assignee": "Maria Lopez", "start": "02:11"},
                {"text": "Draft the launch email and changelog entry for review", "assignee": "Yash Aggarwal", "start": "02:16"},
                {"text": "Confirm the free-tier limit with finance", "assignee": "Priya Sharma", "start": "02:39"},
            ],
        },
    },
    {
        "title": "Discovery Call — Brightwave Logistics",
        "audio": "discovery-call-brightwave-logistics.mp3", "days_ago": 1, "hour": 15,
        "participants": ["Yash Aggarwal", "Olivia Chen", "Tom Becker"],
        "tags": ["sales", "customer"],
        "transcript": """
[00:00] Yash Aggarwal: Hi Olivia, thanks for making the time. I'm here with Tom from our solutions team. We'd love to hear how your team handles meetings today.
[00:08] Olivia Chen: Sure. I run operations at Brightwave. We're about two hundred people, mostly dispatchers and account managers, and we spend a huge amount of time on calls with carriers and shippers.
[00:21] Tom Becker: How do you capture what happens on those calls right now?
[00:24] Olivia Chen: Honestly, badly. Account managers type notes into our CRM after the call, when they remember. Half the time the notes are two lines. When there's a dispute about a rate or a pickup window, we have nothing to go back to.
[00:41] Yash Aggarwal: How often do those disputes come up?
[00:44] Olivia Chen: Probably fifteen to twenty a month. Each one takes a manager a couple of hours to untangle, and some of them cost us real money in credits.
[00:54] Tom Becker: That's a clear use case. Which calling tools are you on?
[00:58] Olivia Chen: Mostly Microsoft Teams internally, and a lot of carriers still just phone us, so we have a dialer as well. It's RingCentral.
[01:08] Tom Becker: Teams we support natively. For RingCentral we can ingest the call recordings through the integration, so those calls get transcribed as well.
[01:17] Olivia Chen: That would matter a lot. Probably sixty percent of the important conversations happen on the phone.
[01:24] Yash Aggarwal: And which CRM?
[01:26] Olivia Chen: HubSpot. If the summary could land on the HubSpot deal automatically, my team would actually use it.
[01:34] Tom Becker: That's exactly how the HubSpot integration works. Summary, action items and a link to the recording get logged against the contact and the deal.
[01:42] Olivia Chen: What about security? Our shippers are sensitive about their rates being stored somewhere.
[01:48] Yash Aggarwal: We're SOC 2 Type II, data is encrypted at rest and in transit, and admins can set retention so recordings are deleted after, say, ninety days.
[01:57] Olivia Chen: I'll need our IT lead to review that. Can you send the security documentation?
[02:04] Yash Aggarwal: Absolutely, I'll send the SOC 2 report and our security whitepaper today.
[02:09] Olivia Chen: Great. What would a pilot look like?
[02:13] Tom Becker: Typically thirty days with one team. I'd suggest your account management team, maybe twenty seats, with HubSpot and RingCentral connected from day one.
[02:23] Olivia Chen: That works. Budget-wise, I have discretion up to about fifteen thousand a year before it needs to go to the CFO.
[02:32] Yash Aggarwal: Twenty seats on the Business plan would come in under that. I'll put together a pilot proposal with pricing.
[02:38] Olivia Chen: Please do. If the pilot works, we'd roll out to dispatch as well, that's another hundred and twenty people.
[02:47] Tom Becker: I'll set up a technical call with your IT lead next week to walk through the integrations and SSO.
[02:52] Olivia Chen: Perfect. Let's aim to start the pilot on the first of next month.
[02:58] Yash Aggarwal: Sounds great. Thanks Olivia, you'll have the documents today and the proposal by Friday.
""",
        "notes": {
            "overview": "Olivia Chen (Head of Operations, Brightwave Logistics, ~200 people) described poor call note-taking that leads to 15–20 rate and pickup disputes a month. Brightwave uses Microsoft Teams, RingCentral for phone calls (about 60% of important conversations) and HubSpot as its CRM. Security is a key concern. Both sides agreed on a 30-day, 20-seat pilot with the account management team starting next month, within Olivia's $15k budget authority, with a possible expansion to 120 dispatch seats.",
            "chapters": [
                {"title": "Current process & pain", "summary": "Notes are typed into the CRM after calls, so there is no record when disputes happen (15–20/month).", "start": "00:08"},
                {"title": "Tooling: Teams, RingCentral, HubSpot", "summary": "Phone calls matter most; HubSpot sync of summaries is the adoption driver.", "start": "00:54"},
                {"title": "Security requirements", "summary": "SOC 2 Type II, encryption and retention controls. IT lead review needed.", "start": "01:42"},
                {"title": "Pilot scope & budget", "summary": "30-day pilot, 20 seats, under $15k. Dispatch expansion if successful.", "start": "02:09"},
            ],
            "action_items": [
                {"text": "Send the SOC 2 report and security whitepaper to Olivia", "assignee": "Yash Aggarwal", "start": "02:04"},
                {"text": "Prepare a 20-seat Business plan pilot proposal with pricing by Friday", "assignee": "Yash Aggarwal", "start": "02:32"},
                {"text": "Schedule a technical call with Brightwave's IT lead on integrations and SSO", "assignee": "Tom Becker", "start": "02:47"},
                {"text": "Get the IT lead to review the security documentation", "assignee": "Olivia Chen", "start": "01:57"},
            ],
        },
    },
    {
        "title": "Engineering Standup",
        "audio": "engineering-standup.mp3", "days_ago": 2, "hour": 9,
        "participants": ["Daniel Kim", "Arjun Mehta", "Sofia Rossi"],
        "tags": ["engineering", "standup"],
        "transcript": """
[00:00] Daniel Kim: Let's go around. Arjun, you want to start?
[00:03] Arjun Mehta: Yesterday I finished the transcript search endpoint. It does a case-insensitive match across all segments and returns snippets. Today I'm adding pagination because one test account has three thousand meetings and the response was huge.
[00:19] Daniel Kim: Any blockers?
[00:21] Arjun Mehta: One. Search is slow on that big account, about two seconds. I think we need a full text index. I'd like to try SQLite FTS5 before we look at anything heavier.
[00:35] Daniel Kim: Try FTS5, but timebox it to a day. If it's not clearly better, we'll talk about it at Thursday's architecture review.
[00:43] Arjun Mehta: Will do.
[00:45] Sofia Rossi: I'm on the player sync. Clicking a transcript line now seeks the audio, and the active line highlights while it plays. The bug from last week where the highlight jumped two lines ahead is fixed. It was an off-by-one in how we compared end times.
[01:00] Daniel Kim: Nice. What's next for you?
[01:03] Sofia Rossi: Auto-scroll. When you manually scroll away, we should stop following playback and show a "sync with audio" button, like Fireflies does. Otherwise the transcript fights the user.
[01:16] Daniel Kim: Good call. How long?
[01:19] Sofia Rossi: I should have it in review by tomorrow.
[01:22] Daniel Kim: From me, I reviewed the action items PR and left a couple of comments. The main one is that the assignee should reference a participant, not be free text. Otherwise we can't group by owner or filter tasks by person.
[01:37] Arjun Mehta: That's my PR, I'll fix it today.
[01:40] Daniel Kim: Thanks. Also a reminder that the on-call rotation changes on Monday. Sofia, you're primary next week.
[01:47] Sofia Rossi: Got it. Can someone walk me through the new alerting dashboard before then?
[01:53] Daniel Kim: I'll do a fifteen minute walkthrough Friday afternoon.
[01:57] Daniel Kim: That's it. Thanks everyone.
""",
        "notes": {
            "overview": "Short standup. Arjun finished the transcript search endpoint and is adding pagination; search is slow (~2s) on very large accounts, so he will spend a day trying SQLite FTS5. Sofia fixed the playback highlight off-by-one bug and is building auto-scroll with a \"sync with audio\" button. Daniel asked for action item assignees to reference participants instead of free text. Sofia is primary on-call from Monday.",
            "chapters": [
                {"title": "Transcript search performance", "summary": "Pagination in progress; FTS5 experiment timeboxed to one day.", "start": "00:03"},
                {"title": "Player & transcript sync", "summary": "Highlight bug fixed; auto-scroll with a sync button is next.", "start": "00:45"},
                {"title": "Code review & on-call", "summary": "Assignees should reference participants; on-call rotation changes Monday.", "start": "01:22"},
            ],
            "action_items": [
                {"text": "Add pagination to the transcript search endpoint", "assignee": "Arjun Mehta", "start": "00:03"},
                {"text": "Timebox a one-day SQLite FTS5 experiment for search", "assignee": "Arjun Mehta", "start": "00:35"},
                {"text": "Change action item assignee to reference a participant", "assignee": "Arjun Mehta", "start": "01:37"},
                {"text": "Ship transcript auto-scroll with a \"sync with audio\" button for review", "assignee": "Sofia Rossi", "start": "01:19"},
                {"text": "Run a 15-minute alerting dashboard walkthrough on Friday", "assignee": "Daniel Kim", "start": "01:53"},
            ],
        },
    },
    {
        "title": "Design Review — Meeting Detail Page",
        "audio": "design-review-meeting-detail-page.mp3", "days_ago": 4, "hour": 14,
        "participants": ["Maria Lopez", "Priya Sharma", "Sofia Rossi"],
        "tags": ["design"],
        "transcript": """
[00:00] Maria Lopez: Thanks for joining. I want feedback on the meeting detail page before we lock it. I'll share my screen.
[00:07] Maria Lopez: The layout is three columns. Smart search and speaker stats on the left, the notes in the middle, and a tabbed panel on the right for the transcript and the AI assistant. The player is pinned along the bottom.
[00:23] Priya Sharma: Why put the player at the bottom rather than above the notes?
[00:28] Maria Lopez: Because people scroll the notes and the transcript a lot. If the player is at the top, it scrolls away and you lose the controls. At the bottom it's always reachable.
[00:37] Sofia Rossi: From an implementation side that's easier too. One player instance for the whole page, and both panels just read the current time.
[00:46] Priya Sharma: Makes sense. What about small screens?
[00:50] Maria Lopez: Under a laptop width, the left column collapses into a drawer and the right panel becomes a tab next to notes.
[01:00] Priya Sharma: The speaker talk time ring is nice, but I'm not sure people understand words per minute.
[01:06] Maria Lopez: Fair. I could add a tooltip explaining it. Talk time percentage is the more useful number anyway, so I'll make that the primary one.
[01:17] Sofia Rossi: One concern. The transcript search highlights matches, but if there are forty matches you have no idea where you are. Can we show "3 of 40" with up and down arrows?
[01:30] Maria Lopez: Yes, that's a good addition. I'll add a match counter with next and previous.
[01:36] Priya Sharma: Colors. The speaker colors are quite saturated on the dark background. They're a bit hard on the eyes.
[01:43] Maria Lopez: I'll tone them down and check contrast. I want every speaker color to pass AA against the panel background.
[01:52] Sofia Rossi: Also, can the action items be edited in place? Opening a modal just to fix a typo feels heavy.
[01:59] Maria Lopez: Agreed. Inline editing for text, and a small dropdown for the assignee.
[02:05] Priya Sharma: Great review. Let's lock it after these changes. Maria, can you have the updated version by Wednesday?
[02:14] Maria Lopez: Yes, Wednesday works.
""",
        "notes": {
            "overview": "Maria presented the three-column meeting detail layout: smart search and speaker stats on the left, notes in the centre, and transcript plus AI assistant tabs on the right, with the player pinned to the bottom so it is always reachable. Feedback: make talk-time percentage the primary speaker metric, add a match counter to transcript search, tone down speaker colours to pass AA contrast, and allow inline editing of action items. The updated design is due Wednesday.",
            "chapters": [
                {"title": "Three-column layout & bottom player", "summary": "The player stays pinned so controls never scroll away; one player instance feeds both panels.", "start": "00:07"},
                {"title": "Responsive behaviour", "summary": "The left column becomes a drawer; the right panel becomes a tab.", "start": "00:50"},
                {"title": "Speaker stats & search UX", "summary": "Talk-time % as the primary metric; add a \"3 of 40\" match navigator.", "start": "01:00"},
                {"title": "Colour contrast & inline editing", "summary": "AA-compliant speaker colours; edit action items in place.", "start": "01:36"},
            ],
            "action_items": [
                {"text": "Add a match counter with next/previous to transcript search", "assignee": "Maria Lopez", "start": "01:30"},
                {"text": "Tone down speaker colours to pass AA contrast", "assignee": "Maria Lopez", "start": "01:43"},
                {"text": "Design inline editing for action item text and assignee", "assignee": "Maria Lopez", "start": "01:59"},
                {"text": "Deliver the updated meeting detail design by Wednesday", "assignee": "Maria Lopez", "start": "02:14"},
            ],
        },
    },
    {
        "title": "Q4 Marketing Planning",
        "audio": "q4-marketing-planning.mp3", "days_ago": 8, "hour": 11,
        "participants": ["Hannah Wright", "Yash Aggarwal", "Tom Becker"],
        "tags": ["marketing", "planning"],
        "transcript": """
[00:00] Hannah Wright: Okay, Q4 planning. I want to leave with three priorities and owners. Let me start with where we are. Signups were up eighteen percent last quarter, but trial-to-paid conversion slipped from nine to seven and a half percent.
[00:16] Yash Aggarwal: Do we know why conversion dropped?
[00:20] Hannah Wright: Partly the mix. A lot of the new signups came from the viral template post, and those people are students and hobbyists. They were never going to pay.
[00:32] Tom Becker: On the sales side, the trials that do convert almost always connected their calendar in the first day. If they don't, they basically never come back.
[00:42] Hannah Wright: That's a strong signal. So priority one: get more trials to connect a calendar on day one.
[00:49] Yash Aggarwal: We could change onboarding so connecting the calendar is the first step, not an optional one at the end. And send a reminder email after two hours if they skip it.
[00:59] Hannah Wright: Let's test it. Yash, can you own the onboarding experiment?
[01:06] Yash Aggarwal: Yes. I'll write the spec this week and aim to launch the A/B test in two weeks.
[01:12] Hannah Wright: Priority two is content for sales teams. Our best customers are sales orgs, but our content is generic productivity stuff.
[01:22] Tom Becker: I can help with that. I have a dozen customer calls where teams explained exactly how they use us for pipeline reviews. With permission, those could become case studies.
[01:33] Hannah Wright: Perfect. Tom, can you get permission from three customers this month?
[01:38] Tom Becker: I'll reach out to five, expecting three to say yes.
[01:42] Hannah Wright: Priority three is the webinar series. One webinar a month on meeting productivity for revenue teams. I'll own that one.
[01:52] Yash Aggarwal: What's the budget looking like?
[01:54] Hannah Wright: Forty thousand for the quarter. Twenty-five goes to paid acquisition targeting sales titles on LinkedIn, ten to content production and five to the webinars.
[02:06] Tom Becker: Can we measure LinkedIn by pipeline rather than signups? Signups will make it look good even if it's the wrong people.
[02:13] Hannah Wright: Yes, good point. We'll report on sales-qualified pipeline from LinkedIn, not signups. I'll set up the attribution with the ops team.
[02:24] Hannah Wright: Great. So, onboarding experiment with Yash, case studies with Tom, webinars and attribution with me. Let's check progress in two weeks.
""",
        "notes": {
            "overview": "Signups grew 18% last quarter, but trial-to-paid conversion fell from 9% to 7.5%, largely because of low-intent viral signups. Trials that connect a calendar on day one are far more likely to convert. The three Q4 priorities are an onboarding experiment that makes calendar connection the first step, sales-focused case studies, and a monthly webinar series for revenue teams. The $40k budget is split 25k LinkedIn / 10k content / 5k webinars, and LinkedIn will be measured on sales-qualified pipeline rather than signups.",
            "chapters": [
                {"title": "Q3 results & conversion drop", "summary": "+18% signups, conversion down to 7.5%, driven by low-intent traffic.", "start": "00:00"},
                {"title": "Priority 1: calendar-first onboarding", "summary": "Day-one calendar connection predicts conversion; A/B test planned.", "start": "00:32"},
                {"title": "Priority 2 & 3: case studies and webinars", "summary": "Sales-team case studies from customer calls; a monthly webinar series.", "start": "01:12"},
                {"title": "Budget & measurement", "summary": "$40k split across channels; measure LinkedIn on pipeline, not signups.", "start": "01:52"},
            ],
            "action_items": [
                {"text": "Write the calendar-first onboarding spec and launch the A/B test in two weeks", "assignee": "Yash Aggarwal", "start": "01:06"},
                {"text": "Ask five customers for case study permission (target three)", "assignee": "Tom Becker", "start": "01:38"},
                {"text": "Launch the monthly webinar series for revenue teams", "assignee": "Hannah Wright", "start": "01:42"},
                {"text": "Set up LinkedIn pipeline attribution with the ops team", "assignee": "Hannah Wright", "start": "02:13"},
            ],
        },
    },
    {
        "title": "Interview — Backend Engineer (Ravi Patel)",
        "audio": "interview-backend-engineer-ravi-patel.mp3", "days_ago": 13, "hour": 16,
        "participants": ["Arjun Mehta", "Ravi Patel"],
        "tags": ["hiring"],
        "transcript": """
[00:00] Arjun Mehta: Hi Ravi, thanks for coming in. I'm Arjun, I lead the backend team here. We'll spend most of the time on a system design question, and you'll have time for questions at the end.
[00:09] Ravi Patel: Sounds great, thanks for having me.
[00:13] Arjun Mehta: Before we start, tell me briefly about your current role.
[00:16] Ravi Patel: I'm a backend engineer at a fintech company, about four years. I own the payments reconciliation service. It's Python and Postgres, processing around two million transactions a day.
[00:29] Arjun Mehta: Nice. Here's the design question. We record meetings and produce transcripts. Design the search so a user can find any phrase across all their meetings in under two hundred milliseconds.
[00:41] Ravi Patel: Okay. First, some questions. How many meetings does a big customer have, and how long is a transcript?
[00:48] Arjun Mehta: Large accounts have tens of thousands of meetings. A one hour meeting is about nine thousand words.
[00:55] Ravi Patel: So a big account could have a few hundred million words. A LIKE query won't scale. I'd build an inverted index. Tokenize each transcript segment and map terms to segment IDs, and keep the segment's start time so results can jump straight into the recording.
[01:13] Arjun Mehta: Where would that index live?
[01:15] Ravi Patel: For an early product, Postgres full text search with a GIN index is plenty and keeps operations simple. At larger scale I'd move to something like OpenSearch, sharded by account, since queries never cross accounts.
[01:31] Arjun Mehta: How do you keep the index up to date when transcripts change, like when a user renames a speaker?
[01:36] Ravi Patel: I'd index asynchronously. When a meeting is processed or edited, publish an event and have a worker reindex just that meeting. Search is eventually consistent, which is fine as long as it's seconds, not minutes.
[01:53] Arjun Mehta: Good. How would you rank results?
[01:57] Ravi Patel: Exact phrase matches first, then recency, since people usually search for recent meetings. Maybe boost matches in the title or the summary over the raw transcript.
[02:07] Arjun Mehta: Great answer. Any questions for me?
[02:10] Ravi Patel: What does on-call look like, and how big is the team?
[02:15] Arjun Mehta: Six engineers, one week on-call every six weeks, and pages are rare, maybe one or two a week. I'll send you our engineering handbook, it covers this in detail.
[02:28] Ravi Patel: That would be great, thank you.
[02:31] Arjun Mehta: Thanks Ravi. The recruiter will be in touch within a few days about next steps.
""",
        "notes": {
            "overview": "System design interview with Ravi Patel, a backend engineer with four years in fintech who owns a payments reconciliation service (Python/Postgres, about 2M transactions per day). Asked to design sub-200ms phrase search across meetings, he sized the data, proposed an inverted index that stores segment start times, started with Postgres full-text search and a GIN index, planned to scale to OpenSearch sharded by account, used async per-meeting reindexing, and ranked by exact match, then recency, then field boosts. A strong, structured answer.",
            "chapters": [
                {"title": "Candidate background", "summary": "Four years in fintech; owns a payments reconciliation service on Python/Postgres.", "start": "00:13"},
                {"title": "System design: transcript search", "summary": "Inverted index with segment timestamps; Postgres FTS first, OpenSearch at scale.", "start": "00:29"},
                {"title": "Index freshness & ranking", "summary": "Event-driven per-meeting reindexing; exact match, then recency, then field boosts.", "start": "01:31"},
                {"title": "Candidate questions", "summary": "Team size and on-call load.", "start": "02:07"},
            ],
            "action_items": [
                {"text": "Send Ravi the engineering handbook", "assignee": "Arjun Mehta", "start": "02:15"},
            ],
        },
    },
]
