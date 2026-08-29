# Written Test · Learning Hub v3

A complete learning loop: **build a batch → PDF lands in your iCloud folder → solve on iPad → Claude Cowork grades it → feedback in the app → next batch is smarter.**

## Deploy (10 minutes)
1. **Supabase upgrade** — open Supabase → SQL Editor → paste the whole `schema.sql` → Run. Safe to re-run. It adds:
   - `written_test_subjects` table (seeded: Maths, Language study, Mechanical) + `subject_id` on topics
   - `tier` / `kind` / `unit_no` columns on `written_test_problems` (+ auto-tags your 30 existing problems)
   - `written_test_batches` table for PDF tracking
   - write policies so you can add subjects/topics/problems from inside the app
   Nothing else on the Supabase side changes — same project, same keys, existing tables untouched.
2. **Copy `learning_hub.html` + `learning_hub.js`** into your repo root next to `index.html`, commit, push. Your existing dashboard keeps working (shared `written_test_attempts` table).
3. Open the deployed `learning_hub.html` in **Chrome/Edge**, sign in with your usual magic link.
4. Create `iCloud Drive/WrittenTest` in Finder → in the app: **Setup → Link folder** → pick it. The app creates `outbox/ solved/ graded/` and writes `COWORK_TASK.md` (personalised with your user id).
5. Save your Supabase **service role key** (Settings → API) to `~/.config/writtentest/service_role_key`. Never commit it, never put it in the synced folder.
6. Point Claude Cowork at the folder's `COWORK_TASK.md` and tell it to watch `solved/`.

## Daily loop
1. **Build a batch** — the queue auto-ranks: weak spots → due for review (spaced repetition off your ratings) → new problems in path order. Filter by tier/kind, export.
2. PDF + manifest land in `outbox/`, iCloud syncs them to the iPad Files app.
3. Solve with the Pencil (Markup), save the PDF into `solved/`.
4. Cowork grades it, writes attempts + feedback straight to Supabase, marks the batch `graded`, archives the PDF.
5. Open **Review** in the app — feedback is there, and the next batch re-ranks automatically. Your existing `index.html` dashboard keeps working (same `written_test_attempts` table).

## Notes
- Mobile: browsing, adding content, building batches and reading feedback all work; folder auto-save is desktop Chrome/Edge only (mobile exports download normally).
- No folder linked? Export still works — the PDF just downloads.
- Spaced repetition: rating 1–2 → due next day, 3 → 3 days, 4 → 7 days, 5 → 14 days.
- "Explore with sample data" on the sign-in screen shows the whole app without touching your data.
