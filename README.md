# Learning Hub

A personal study app: **build a batch of problems → the PDF lands in your iCloud folder → solve it by hand on the iPad → Claude Cowork grades it → feedback shows in the app → the next batch is smarter.** Plus a **Ghost test** for handwriting Japanese vocabulary with the Apple Pencil.

Plain HTML, CSS and JavaScript — no build step. Data lives in Supabase.

## Run it
- **Hosted:** open the deployed `index.html` in Chrome or Edge and sign in (Google, or an email link). "Explore with sample data" shows the whole app without touching your data.
- **Install on a phone or iPad:** open the hosted page, then Share → *Add to Home Screen* (Safari) or *Install app* (Chrome). Before going offline, open the installed app online and use **Settings → Download study offline**. A first visit or install alone does **not** make the Library available offline.
- **Local:** double-click `run-written-test-local.bat` (Windows, needs Python) or run `python -m http.server 5182` in this folder and open `http://localhost:5182/`.

## Phase 7: verified offline result synchronization

While connected and signed in to General_apps, open **Settings → Sync pending Hub / Quick results**. The app verifies your live Supabase identity and allowlist, reads any existing attempt UUIDs, inserts only missing Hub/Quick records and checks every result from the server before atomically removing its queued local session. It retains conflicts and interrupted sessions for retry/export. A local receipt is recorded after every verified session; **Export sync receipts** downloads a metadata-only audit trail.

**Auto-sync after reconnecting** is optional and **off by default**. When enabled, it runs only for the current verified account while you are not actively inside Ghost Test or Quick Practice. Manual **Export pending results** remains available as a private backup.

**Japanese writing results remain local.** The Technical Japanese project's anonymous review permissions and cross-project identity still need a secure, transactional, idempotent replay contract. The app deliberately does not upload or delete those pending Japanese sessions. No production Supabase schema or policies are changed in this phase.

Phase 7 introduces a new app-shell/cache version. After updating online, select **Download study offline** again so the installed iPad app has the new sync module. Old offline caches and drafts are not cleared. See the [Phase 7 acceptance guide](docs/phase7-safe-offline-sync.md) for Wi-Fi-loss, conflict and real-device checks.
## Phase 6: reliable offline startup and study packs on iPad

In the **installed Home Screen app** (or Safari tab you will actually reopen offline), sign in while connected, then open **Settings → Study offline on iPad → Download study offline**. The download checks all current app scripts and assets, shows a file/MB progress indicator, resumes after interruption and stores a previously verified, versioned Library snapshot. Only a complete pack is labeled **Ready offline**. Reopen that same app in airplane mode to study.

Offline Home, Library, Review, Analytics, Hub Ghost Test and Quick Practice use downloaded content. You may also save a Japanese Ghost Test sheet while online and open it later from **Ghost Test → Saved Japanese sheet**. Imported multilingual writing packs retain their existing device-local storage.

**Offline answers are saved locally, not synced.** Hub/Quick/Japanese attempts and Pencil strokes are queued with stable IDs and can be exported using **Settings → Export pending results**. Quick Practice can complete multiple sessions. Reconnect manually to reverify your account; do not clear site data or uninstall while results are pending. Automatic, conflict-safe synchronization is deliberately postponed to **Phase 7**.

The offline cache and IndexedDB schema are reconciled with the earlier unmerged PR #5, but that outdated branch should **not** also be merged. Account-keyed local storage is not encrypted and cannot be remotely revoked while a device has no connection. The [Phase 6 airplane-mode acceptance guide](docs/phase6-ipad-offline.md) requires real iPad testing before merging or deploying.
## Phase 5: iPad UI, Apple Pencil and accessibility

The Ghost Test now exposes Japanese sets, language packs and Hub topics even on narrow mobile screens. The handwriting canvas isolates the active Pencil pointer from palm touches, preserves meaningful strokes when a gesture is canceled, and prevents ink changes while a save is awaiting confirmation. Numbered mark targets are native buttons for iPad VoiceOver and hardware keyboards.

Navigation has a Skip-to-main control and screen-reader page announcements; Quick Practice restores focus when changing questions and revealing an answer. Touch controls and reduced-motion settings have also been improved. The installed app shell has a new service worker version; do **not** clear website data to update it.

These improvements are for the **online app's iPad readiness**, not completion of offline studying. The [Phase 5 iPad acceptance checklist](docs/phase5-ipad-accessibility.md) still needs to be tested physically with Safari/VoiceOver/Apple Pencil before merging.
## Phase 4: multilingual handwriting packs

From **Ghost Test → 🌐 Language packs**, import a public-content JSON vocabulary pack to practise Burmese, Chinese, Japanese, Malay, Marathi or other Unicode scripts using the existing Apple Pencil writing canvas. Choose **Word → meaning**, **Word → reading**, or **Meaning/reading → write word**. A downloadable Burmese sample JSON is provided in the app.

Imported vocabulary and practice marks stay **on this device, scoped to your signed-in account**; evidence can be exported as a private JSON file. Existing Japanese Ghost Test, Hub problems, PDF worksheets and Quick Practice remain unchanged. Multilingual practice does **not** write progress into Technical Supabase, the Japanese project or the Shared Vocabulary Foundation.

The portable `wt-writing-pack-v1` and future `lex-v1-public-export` contracts preserve source identifiers without merging homographs. The F1A/F1B Shared Vocabulary schema is not deployed to the connected Technical production DB and no secure cross-project vocabulary adapter is available yet; account mapping, RLS review and F1C/F2 approval are prerequisites for true cross-app synchronization. See [Phase 4 contracts and iPad acceptance](docs/phase4-multilingual-writing-packs.md).
## Phase 3: Learning analytics

From **Home → Learning trends** (or the desktop **Analytics** sidebar), see 7-, 30-, and 90-day activity, per-topic coverage, current weak/due questions and repeated mistakes. Cowork-graded, Quick Practice self-rated, and Hub Ghost Test results are shown separately—self-ratings are not treated as equivalent to independent grading. Each focus item can open a related practice topic or worksheet.

Use **Refresh complete history** to retrieve more than the initial Supabase page of attempts; the app leaves existing data in place if retrieval fails or exceeds its 10,000-row limit. **Download text report** exports summary counts without reference answers or detailed feedback notes. Japanese Study's separate project and device-only Japanese Ghost sessions are deliberately excluded until a secure shared-history integration exists.

See [Phase 3 acceptance checklist](docs/phase3-learning-analytics.md). This is still part of the pre-offline improvement sequence.
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
| **Analytics** | 7/30/90-day source-separated learning trends, current focus questions, coverage by topic, and downloadable summary reports. |
| **Ghost test** | Write on screen; mark ✓ △ ✗ by tap-cycle or drag; per-word clock with a slow-but-correct half-step; results go to `japanese_user_reviews` (or `written_test_attempts` for hub topics). The sheet survives a reload for 7 days. Shortcuts: `?` lists them. |
| **Multilingual packs** | Script-neutral Apple Pencil writing from imported JSON vocabulary, with separate local-only evidence and private export. No automatic cross-project sync. |
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
js/offline_store.js      existing IndexedDB pack schema, offline asset download and pending queue
js/offline_sync.js       authenticated, insert-only pending result replay and receipt verification
js/multilingual_core.js   portable vocabulary import format and evidence contract
js/multilingual_packs.js  local per-account packs, handwriting mode picker, export
js/learning_analytics.js  data-only calculations: dates, methods, repeated mistakes
js/analytics_view.js      analytics charts, filters, refresh, reports and practice actions
js/ghost_test.js           ghost test: sheet, ink, marking, clock, SRS, draft, session log
js/japanese_source.js      Japanese-database panel: sets, modes, direction, streak
fonts/NotoSansJP-Regular.ttf  subset font embedded in PDFs when needed (OFL)
manifest.webmanifest       install metadata (name, colours, icons)
sw.js                      service worker: cached current app shell, bounded offline navigation; no Supabase API caching
icons/                     app icons (筆 on the app green)
worksheets/*.html          standalone practice sheets
ghost-test-20-standalone.html  self-contained ghost test
dev-phases.md              development plan and status
phases.md                  ghost-test design notes
run-written-test-local.bat local server (Windows)
sql/                       schema and policies — git-ignored, keep locally
```
