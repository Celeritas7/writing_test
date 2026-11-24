# Learning Hub

A personal study app: **build a batch of problems → the PDF lands in your iCloud folder → solve it by hand on the iPad → Claude Cowork grades it → feedback shows in the app → the next batch is smarter.** Plus a **Ghost test** for handwriting Japanese vocabulary with the Apple Pencil.

Plain HTML, CSS and JavaScript — no build step. Data lives in Supabase.

## Run it
- **Hosted:** open the deployed `index.html` in Chrome or Edge and sign in (Google, or an email link). "Explore with sample data" shows the whole app without touching your data.
- **Install on a phone or iPad:** open the hosted page, then Share → *Add to Home Screen* (Safari) or *Install app* (Chrome). It opens full screen with its own icon, and after the first visit it starts even with no connection (your data still needs one).
- **Local:** double-click `run-written-test-local.bat` (Windows, needs Python) or run `python -m http.server 5182` in this folder and open `http://localhost:5182/`.

## Phase 2: Quick Practice

From **Home → Quick Practice**, choose Due today (weak + due), Weak spots, New questions, or Random, optionally filter by subject/topic, and set a 5-, 10-, or 20-minute goal. Practise one Library question at a time, optionally type an answer, reveal the reference, and self-rate ✓ / △ / ✗. The session offers Pause/Resume, Previous/Next and Skip. The clock pauses when you leave or hide the tab; an interrupted draft resumes paused.

**Finish and save** writes self-rated attempts (`graded_by='self'`) into the existing Learning Hub review history. On failed sync the draft stays pending and may be retried with the same record IDs or exported as a private JSON backup. Demo mode saves no personal data. This mode does not provide AI grading or freehand handwriting; use Ghost Test or a PDF for Apple Pencil writing.

On small iPad/phone screens, Quick Practice is reached from Home or Build; the existing six bottom tabs are unchanged. [Phase 2 acceptance checklist](docs/phase2-quick-practice.md). This remains a pre-offline feature.
## Phase 1: worksheet submission and grading

Build now supports **A4 (default)** or **US Letter**, with continuation pages for long questions and given data. Each new `WT2_` batch creates a **student PDF + answer-free manifest** and a **separate PRIVATE grader key**; only the latter contains reference answers and stable `attempt_id` fields used to avoid duplicate grading attempts.

On iPad Safari, the desktop folder-link API is unavailable. Export the PDF and safe manifest, move both to `iCloud Drive/WrittenTest/outbox/` using Files, solve using Apple Pencil/Markup, and save the annotated PDF in `solved/`. Explicitly download and privately transfer the `.grader.json` key into `grader/` when needed. From **Review**, confirm the file is in solved/, then use **Check feedback** and **Refresh feedback** after Cowork grades it. New batches cannot be manually marked graded until all expected Cowork result IDs are found.

If your desktop folder was linked before Phase 1, use **Settings → Update grading instructions** to update `COWORK_TASK.md`. The older `WT_` batches keep their manual status controls.

Full acceptance checklist: [docs/phase1-worksheet-grading.md](docs/phase1-worksheet-grading.md). Offline support remains a separate draft PR.

## One-time setup
1. **Supabase** — run `sql/schema.sql` in the SQL editor of your project (the `sql/` folder is git-ignored; keep it locally). It creates `written_test_subjects / topics / problems / attempts / batches` and the write policies the app needs.
2. **Keys** — `js/learning_hub.js` holds the project URL and anon key; `js/ghost_test.js` holds the Japanese project's URL, anon key and your user id (defaults — Connection settings in the Ghost test override them).
3. **iCloud folder** — create `iCloud Drive/WrittenTest`, then **Settings → Link folder** in the app. It creates `outbox/ solved/ graded/ grader/` and writes `COWORK_TASK.md`. After a reload Chrome asks for one click to reconnect; Settings and Build offer it.
4. **Cowork** — point Claude Cowork at `COWORK_TASK.md` and keep the Supabase service-role key at `~/.config/writtentest/service_role_key` (never inside the synced folder). Reference answers are in `grader/`, never in `outbox/`.

## Screens
| Screen | What it does |
|---|---|
| **Home** | Due today + Start, streak, 7-day accuracy, last sheet's marks. Phones open here; the Home tab shows the due count as a badge. |
| **Library** | Subjects → topics → problems. Add, rename, reorder, edit, delete. Multi-line prompts. |
| **Build a batch** | Ranks weak → due → new; problems already out in an ungraded batch drop to the bottom. Exports a PDF (+ manifest) to `outbox/`, or downloads both. Japanese and maths symbols print via an embedded Noto Sans JP subset. |
| **Review** | Cowork feedback (filter by topic, batch, wrong only), batches you can open and mark solved/graded, ghost sheets as one card per session, "Practise again" and "Retry the wrong ones". |
| **Ghost test** | Write on screen; mark ✓ △ ✗ by tap-cycle or drag; per-word clock with a slow-but-correct half-step; results go to `japanese_user_reviews` (or `written_test_attempts` for hub topics). The sheet survives a reload for 7 days. Shortcuts: `?` lists them. |
| **Settings** | **Account** first (who is signed in, Sign out, Install app), then the loop, folder link / reconnect and grader instructions. |

On phones the sections are a bottom tab bar; on wider screens they are the left sidebar.

## Spaced repetition
- Hub problems: rating 1–2 → due next day, 3 → 3 days, 4 → 7 days, 5 → 14 days.
- Ghost words: ladder 1 · 2 · 4 · 8 · 16 · 30 · 60 · 120 days; ✓ steps up, △ steps down, ✗ resets; a ✓ slower than 1.5× your own median for that word advances half a step. All dates are local calendar days.

## File layout
```
index.html                 shell: sign-in gate, sidebar, #main, toast
css/learning_hub.css       all styles (responsive rules in §8)
js/learning_hub.js         auth, data, Home / Library / Build / Review / Settings, PDF export
js/worksheet_handoff.js   manifest separation and deterministic grading IDs
js/quick_practice.js     timed self-rating, draft recovery, safe attempt syncing
js/ghost_test.js           ghost test: sheet, ink, marking, clock, SRS, draft, session log
js/japanese_source.js      Japanese-database panel: sets, modes, direction, streak
fonts/NotoSansJP-Regular.ttf  subset font embedded in PDFs when needed (OFL)
manifest.webmanifest       install metadata (name, colours, icons)
sw.js                      service worker: offline app shell, never caches Supabase data
icons/                     app icons (筆 on the app green)
worksheets/*.html          standalone practice sheets
ghost-test-20-standalone.html  self-contained ghost test
dev-phases.md              development plan and status
phases.md                  ghost-test design notes
run-written-test-local.bat local server (Windows)
sql/                       schema and policies — git-ignored, keep locally
```
