# Learning Hub

A personal study app: **build a batch of problems → the PDF lands in your iCloud folder → solve it by hand on the iPad → Claude Cowork grades it → feedback shows in the app → the next batch is smarter.** Plus a **Ghost test** for handwriting Japanese vocabulary with the Apple Pencil.

Plain HTML, CSS and JavaScript — no build step. Data lives in Supabase.

## Run it
- **Hosted:** open the deployed `index.html` in Chrome or Edge and sign in (Google, or an email link). "Explore with sample data" shows the whole app without touching your data.
- **Local:** double-click `run-written-test-local.bat` (Windows, needs Python) or run `python -m http.server 5182` in this folder and open `http://localhost:5182/`.

## One-time setup
1. **Supabase** — run `sql/schema.sql` in the SQL editor of your project (the `sql/` folder is git-ignored; keep it locally). It creates `written_test_subjects / topics / problems / attempts / batches` and the write policies the app needs.
2. **Keys** — `js/learning_hub.js` holds the project URL and anon key; `js/ghost_test.js` holds the Japanese project's URL, anon key and your user id (defaults — Connection settings in the Ghost test override them).
3. **iCloud folder** — create `iCloud Drive/WrittenTest`, then **Setup → Link folder** in the app. It creates `outbox/ solved/ graded/ grader/` and writes `COWORK_TASK.md`. After a reload Chrome asks for one click to reconnect; Setup and Build offer it.
4. **Cowork** — point Claude Cowork at `COWORK_TASK.md` and keep the Supabase service-role key at `~/.config/writtentest/service_role_key` (never inside the synced folder). Reference answers are in `grader/`, never in `outbox/`.

## Screens
| Screen | What it does |
|---|---|
| **Home** | Due today + Start, streak, 7-day accuracy, last sheet's marks. Phones open here. |
| **Library** | Subjects → topics → problems. Add, rename, reorder, edit, delete. Multi-line prompts. |
| **Build a batch** | Ranks weak → due → new; problems already out in an ungraded batch drop to the bottom. Exports a PDF (+ manifest) to `outbox/`, or downloads both. Japanese and maths symbols print via an embedded Noto Sans JP subset. |
| **Review** | Cowork feedback (filter by topic, batch, wrong only), batches you can open and mark solved/graded, ghost sheets as one card per session, "Practise again" and "Retry the wrong ones". |
| **Ghost test** | Write on screen; mark ✓ △ ✗ by tap-cycle or drag; per-word clock with a slow-but-correct half-step; results go to `japanese_user_reviews` (or `written_test_attempts` for hub topics). The sheet survives a reload for 7 days. Shortcuts: `?` lists them. |
| **Setup** | The loop, folder link / reconnect, grader instructions. |

## Spaced repetition
- Hub problems: rating 1–2 → due next day, 3 → 3 days, 4 → 7 days, 5 → 14 days.
- Ghost words: ladder 1 · 2 · 4 · 8 · 16 · 30 · 60 · 120 days; ✓ steps up, △ steps down, ✗ resets; a ✓ slower than 1.5× your own median for that word advances half a step. All dates are local calendar days.

## File layout
```
index.html                 shell: sign-in gate, sidebar, #main, toast
css/learning_hub.css       all styles (responsive rules in §8)
js/learning_hub.js         auth, data, Home / Library / Build / Review / Setup, PDF export
js/ghost_test.js           ghost test: sheet, ink, marking, clock, SRS, draft, session log
js/japanese_source.js      Japanese-database panel: sets, modes, direction, streak
fonts/NotoSansJP-Regular.ttf  subset font embedded in PDFs when needed (OFL)
worksheets/*.html          standalone practice sheets
ghost-test-20-standalone.html  self-contained ghost test
dev-phases.md              development plan and status
phases.md                  ghost-test design notes
run-written-test-local.bat local server (Windows)
sql/                       schema and policies — git-ignored, keep locally
```
