# Learning Hub — production handoff

Drop-in static page in the same pattern as `writing_test/index.html` (plain HTML/CSS/JS + Supabase, no build step). Fully separate from the Commonplace Written Test app: own file, own `learning_hub_*` tables, no Commonplace links.

## Files
- `learning_hub.html` — the whole app, single file. Works immediately in demo mode (localStorage); wire Supabase by filling the `CONFIG` block at the top of the script.
- `schema.sql` — run in the Supabase SQL editor. Uses the same project as `written_test_*` so magic-link auth is shared (sign in once). For zero coupling, run it in a new Supabase project instead and paste that project's url/key.

## The loop, precisely
1. **Build batch** → suggested from `learning_hub_queue` view (overdue → weak → one new); edit, then **Export PDF** = browser print (Cmd/Ctrl+P) → "Save as PDF" → choose `iCloud Drive › Commonplace Study › Outbox`. Print CSS renders one grid-paper page per problem + an answer-lines footer; screen chrome is hidden.
2. **iPad**: Outbox syncs via iCloud; open in GoodNotes, solve, export the annotated PDF into `Solved/`.
3. **Grade**: back on the laptop, the Review inbox lists batches; the AI first pass is a stub (`aiGrade()` — wire to a Supabase Edge Function calling the Anthropic API with the scanned PDF; TODO marked). You confirm/override each verdict.
4. **Save feedback** → inserts into `learning_hub_feedback`; the queue view immediately re-ranks, so the next suggested batch reflects it.

## Not automatable from a browser
Watching the iCloud `Solved/` folder can't happen in a web page. Two easy options (both noted in the file):
- Mark a batch "solved" manually with one click in the inbox (default).
- Or an iOS Shortcut / macOS Folder Action that POSTs to a Supabase Edge Function when a file lands in `Solved/`.
