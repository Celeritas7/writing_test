# Phase 4 — Multilingual handwriting and shared-vocabulary bridge

Repository: `Celeritas7/writing_test`. Branch based on merged Phase 3 PR #10 on `main`.

## Important integration boundary

The source contract in `Celeritas7/Catalyst/docs/shared-vocabulary-f1a-contract.md` requires verified cross-project identities, immutable source IDs and separate skill evidence. The F1B SQL in Catalyst still describes its tables as proposal/staging-only and revokes browser access until a later approved API. A read-only query of Technical production `information_schema.columns` on November 24, 2026 returned **no `lex_*` tables**. This phase therefore **does not** connect directly to Technical Supabase, guess a login mapping, use the old Japanese anonymous key for another language, or write `lex_user_evidence`.

Instead, Phase 4 adds a **portable, public-content vocabulary import format** plus account-scoped local handwriting and evidence export. This allows iPad Apple Pencil practice without waiting for the canonical vocabulary service. A later approved F1C/F2 adapter can consume a verified public export and migrate local evidence only after owner verification.

## Features

- Ghost Test now has **🌐 Language packs** alongside the existing Japanese database and Hub topics. On a fresh account with no Hub language topics, the panel is also accessible from the empty screen.
- Import a JSON file with up to 500 words and 2 MB per file, up to 12 local packs. `wt-writing-pack-v1` is the app's portable contract; `lex-v1-public-export` is an explicitly versioned **future-approved** mapping shape, not an assertion that the server has deployed it.
- The panel includes **Download sample JSON template** (Burmese example), item counts, available writing directions and a button to export private local sessions.
- Three script-neutral directions: **Word → meaning** (requires a meaning), **Word → reading** (requires an explicit reading/transliteration) and **Meaning or reading → write word** (requires one of those fields). No automatic sandhi, tone, transliteration or character conversion is invented.
- Existing Apple Pencil canvas, eraser, marking, time tracking and key overlay are reused. Unicode forms are preserved, and native browser font fallback handles script support; specific device fonts must be tested.
- A pack keeps each immutable `id` and optional source project/app/table/key, source PK type, canonical entry/form/sense IDs. No merges are performed by identical spelling; duplicate pack record IDs are rejected rather than silently combined.
- New imported-language drafts live under an **account-specific** IndexedDB key `gh-draft-lex-<account id>`. Existing `gh-draft` Japanese/Hub drafts are left in place. The panel offers **Resume unfinished imported handwriting** when a local account-owned draft exists.
- Imported-language results are stored **only in local IndexedDB** as `wt-writing-evidence-v1` sessions. The event ID (`session_id:item_id`) is stable, repeated saves are idempotent, and raw mark labels are retained. Correct marks are learner self-checks, not independent grades.
- Export local writing evidence as private JSON for later authorized migration. No automatic syncing to `japanese_user_reviews`, `written_test_attempts`, or shared `lex_user_evidence` occurs. No invented mastery conversion is applied; writing and recognition are separate skills.
- No automatic deletion of old local evidence: the app stops accepting new sessions at 200 and asks for export before continuing. Deleting a content pack preserves already recorded local sessions.

## Portable pack example

```json
{
  "format": "wt-writing-pack-v1",
  "language_code": "my",
  "name": "Burmese handwriting sample",
  "items": [
    {"id": "sample-1", "form": "မင်္ဂလာပါ", "reading": "mingalaba", "meaning": "hello", "script": "Mymr"},
    {"id": "sample-2", "form": "ရေ", "reading": "ye", "meaning": "water", "script": "Mymr"}
  ]
}
```

Optional source provenance on an item can use a `source` object containing `project`, `app`, `table`, `id`, `pk_type`, `entry_id`, `form_id` and `sense_id`. All values are public metadata, not authorization. The tool also accepts `lex-v1-public-export` with `records[]` containing `id`, `form_text`, `reading` or `transliteration`, `gloss_text` or `gloss`, and optional `source_*` and canonical IDs. Nothing is written back to the source DB.

## Real iPad acceptance checklist — before merging

1. Open a Phase 4 preview on the actual iPad. Sign in, go to **Ghost Test → 🌐 Language packs**, download the sample JSON and import it through the Files picker.
2. Confirm script glyphs render correctly (particularly Burmese vowel signs and marks). Repeat with a user-prepared Chinese and Marathi/Devanagari pack and test portrait/landscape orientation.
3. Start each available mode and write using Apple Pencil. Check that **Show key** shows the expected script text; correct/partial/wrong marks work and the writing area remains usable after rotation.
4. Save results and confirm the message says **saved on this device only**. Check that Japanese Study and Writing Test review tables were not modified by imported-pack practice.
5. Start a different imported sheet, make ink and marks, close/reopen the app, and use **Resume unfinished imported handwriting**. Confirm strokes, marks and session ID survive, separate from any existing Japanese Ghost draft.
6. With a failed local storage write, confirm the app does not clear unfinished ink or claim a completed save. Retry without duplicating the session.
7. Export the private local evidence JSON and inspect the original source IDs, script, language, raw marks, direction, self-assessed status and stable source event keys.
8. On another signed-in account in the same browser, confirm neither packs nor prior evidence nor imported draft appears. Return to the first account and confirm its saved packs remain.
9. Try importing malformed JSON, duplicates, over-size files, and a pack containing a field named `access_token` or `user_id`: import must fail with a clear message.
10. Test existing Japanese database Ghost Test, old Hub Ghost Test, Quick Practice, PDF Build, and Analytics to make sure nothing changed their save behavior.
11. Check iPad Safari Home Screen data persistence and storage use. Do not clear website data or remove the app with unsynced private results.

## Automated checks

- `node --test tests/phase0-safety.test.cjs tests/phase1-workflow.test.cjs tests/phase2-quick-practice.test.cjs tests/phase3-learning-analytics.test.cjs tests/phase4-multilingual-packs.test.cjs`
- Phase 4 tests validate Unicode, normalization, source metadata, credential rejection, multiple handwriting directions, raw evidence semantics, idempotent local save, account isolation, draft protection and app-shell inclusion.
- These were checked in an isolated JavaScript harness, but a live Safari/Apple Pencil and Supabase integration test was **not performed**.

## Limitations / prerequisites for real shared vocabulary synchronization

- No deployed shared `lex-v1` endpoint was available to verify. The JSON bridge is compatible in intent with F1A/F1B source/mapping concepts, **not** proof of API or SQL compatibility with a future deployed service.
- Confirm and secure Technical Supabase account mapping, grants, RLS and cross-project session claims before enabling any direct authenticated content access or user-evidence upload. The earlier permissive Japanese RLS policies remain a separate security blocker.
- F1C/F2 must map source records to approved lexemes/senses/forms; separate writing from recognition; retain category semantics; and deduplicate by immutable event IDs without overriding other apps' progress.
- The multilingual pack browser currently stores imported content and evidence on one device. iPadOS may evict local browser storage. Export local results regularly; backups are not a substitute for a tested cloud sync.
- These changes do **not** deploy, merge, modify production databases or storage, or update the unmerged iPad offline PR #5.

## Next

Phase 5 — UI, accessibility and physical iPad acceptance, then Phase 6–7 offline study reliability and synchronization once the core platform is validated.
