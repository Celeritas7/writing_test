# Phase 7 — Safe offline result synchronization and recovery

Repository: `Celeritas7/writing_test`. Baseline: `main` after Phase 6 PR #13 was merged.

## Scope and safety contract

This phase adds **manually triggered**, owner-verified synchronization for General_apps Hub Ghost Test and Quick Practice attempts, plus **explicitly opt-in** auto-sync after reconnecting. The app never replays Japanese `japanese_user_reviews`/`japanese_user_markings` aggregate updates. Those sessions are kept locally because the Technical project's cross-project user mapping and idempotent server-side review contract are not yet ready.

The intended flow is:

1. User finishes writing offline; Phase 6 queues session with UUID attempt IDs and marks/Pencil strokes in the original IndexedDB `pending` store.
2. User reconnects, opens Settings and selects **Sync pending Hub / Quick results**. Alternatively, after the user has explicitly enabled the **Auto-sync after reconnecting** setting, the app can retry when it is not on a Ghost or Quick Practice screen.
3. Authenticate with `sb.auth.getUser()` **over the network** and confirm exact Supabase user ID against the open session. Recheck the General_apps allowlist. No cached offline claim authorizes uploads.
4. For each Hub/Quick job: validate the owner, idempotent UUIDs, grading source, marks and timestamps; read existing server rows by UUID within user-scoped RLS.
5. If an existing record matches, treat it as previously delivered. If any fields disagree, **do not overwrite** and keep the local job for investigation.
6. Insert **only missing** rows, never upsert/overwrite. Even if the request returns a lost-acknowledgement error, read the server again to see whether it actually committed.
7. Verify every row back from Supabase, including ID, owner, problem, topic, grading method, correct/rating, notes, timestamps and scores.
8. Only then atomically write a local synchronization receipt and remove the verified job from the pending store in one IndexedDB `readwrite` transaction over `pending` and `meta`. A crash, mismatch, permission failure, disconnect or uncertain acknowledgement **retains the job**.
9. The Review and Analytics screens keep unsynced local attempts visible alongside online data and replace confirmed local rows with authoritative server records when synced.

## What changed

- `js/offline_sync.js`: owner verification, validation, existing-record comparison, insert-only replay, post-insert read-back, conflict handling, progress and optional `navigator.locks` cross-tab exclusion. Without Web Locks support, the UUID/unique-key design prevents duplicate records from becoming destructive; concurrent duplicate inserts are resolved by another read-back.
- `js/offline_store.js`: atomic `acknowledge()`, `receipts()`, and per-account `getSyncPreference()` / `setSyncPreference()` within the existing `wt-ipad-offline-v1` IndexedDB version 1. **No database upgrade or old-data deletion.** Verified receipts are retained rather than silently pruned.
- Settings: **Sync pending Hub / Quick results**, manual consent before writing, Hub/Quick versus Japanese pending counts, disabled buttons in offline mode, optional auto-sync (default OFF) and **Export sync receipts**. The existing **Export pending results** still exports all local jobs (including Japanese marks/Pencil strokes) without deleting them.
- Review and full Analytics refresh: preserve pending local attempts and their 'Saved locally · pending sync' status even when the online results are refreshed.
- Service worker/cache: include `js/offline_sync.js`, bump shell to `lh-v2-phase7` and use new `wt-ipad-assets-phase7` download namespace. **Old Phase 6 and earlier caches are not deleted.** Use Settings → Download study offline again after upgrading to cache the new module.

## Explicitly blocked Japanese replay

Read-only Supabase policy audit: General_apps `written_test_attempts` has the authenticated-owner `auth.uid() = user_id` policy for both read and write. The Technical Japanese `japanese_user_reviews` / `japanese_user_markings` tables still expose permissive `anon,authenticated` `true` read/insert/update policies alongside owner-scoped policies; permissive policies combine in a way that defeats strict per-user isolation. The current Japanese client sends a configured user ID, not an independently verified cross-project bearer identity.

Japanese user review counters/history are aggregates. Blindly inserting or replaying them can double-count answers, especially after a partially completed earlier write. **No Japanese pending session is deleted, uploaded or marked synchronized by this PR.** A separate Technical-project authorized RPC/transactional event-ledger proposal, secure account mapping, RLS cleanup, backup and a cross-app migration review are required before enabling that pathway.

## Reconnection and iPad acceptance (manual)

1. In a preview build based on this branch, sign in online on the actual iPad and use Settings → Download study offline so the Phase 7 script and cache are complete. Do not clear website data or reinstall.
2. Open a Hub Ghost Test in airplane mode, write with Apple Pencil and rate several questions. Finish the sheet, then complete two Quick Practice sessions offline. Check Settings shows the expected Hub/Quick pending count.
3. Download a Japanese sheet while online, return to airplane mode, finish it and confirm a **Japanese held locally** count. It must never be presented as safely synchronized.
4. Before syncing, choose **Export pending results** and keep the private JSON in Files/iCloud outside the app cache. The export must contain the expected original UUIDs, handwriting strokes and marks.
5. Restore Wi-Fi, open **Reconnect online** in the offline app (requires reload and verified sign-in). Do not permit auto-sync yet.
6. In Settings, tap **Sync pending Hub / Quick results** and confirm the explanation. Check that result numbers progress and that verification receipts are created only for confirmed rows.
7. Inspect the real `written_test_attempts` records for the exact UUIDs using authenticated, authorized methods. No duplicate records or changed Cowork feedback should appear. Review and Analytics should update.
8. Disconnect/reconnect while syncing, then use Sync again. Already delivered UUIDs must be recognized by server read-back, not duplicated; any unconfirmed session must remain pending.
9. Simulate a mismatched server record with a test fixture in a nonproduction environment. Sync must report a conflict, **not** overwrite that record, and leave the local session/answers intact. Do not deliberately write conflicting rows into production.
10. Enable the opt-in auto-sync checkbox. Try reconnecting while on Ghost Test or Quick Practice: active writing should not be interrupted. From Home/Settings, a later authenticated reconnect can attempt pending Hub/Quick sync. Turn off auto-sync again.
11. Export **sync receipts**: the JSON should contain job IDs, row UUIDs, confirmation timestamps, and owner ID, but no answer strings, strokes or service-role credentials.
12. Verify another Supabase account cannot sync the first account's records. Test an expired session/network unavailable case: show a clear error and keep all pending data.
13. Reopen the Home Screen app in airplane mode and confirm older cached study packs, imported multilingual vocabulary, saved Japanese sheets, and unfinished pencil drafts still exist.
14. Verify online PDF Build, Cowork feedback, Japanese live browsing, and original Phase 0–6 workflows. Do not claim final release readiness until physical iPad, actual Safari WebKit, Home Screen storage partition, Google login and real Supabase tests pass.

## Current limitations

- Server RLS and signed-in identity are security boundaries; the local owner key/receipt are **not encryption or a way to revoke downloaded information remotely**.
- Automatic sync is **off by default** and only runs for the current signed-in account away from active Ghost and Quick screens. Manual Sync Now is always available when online and eligible jobs exist.
- Failures or conflicts remain pending until reviewed/exported; there is **no discard-all or destructive reset** in this phase.
- A private backup export is optional before sync, but receipts store a local, non-sensitive audit trail after verified acknowledgement.
- IndexedDB eviction or manual browser-data clearing can still erase data; save private backups outside Safari on your device.
- This PR does not create a server RPC, alter any production SQL/RLS, deploy, merge or modify the obsolete PR #5.

## Tests and deployment checkpoint

- Phase 7 isolated checks cover insert-only replay, lost acknowledgements, authenticated owner/allowlist verification, field conflicts, duplicate UUIDs, Japanese hold, opt-in auto-sync and response verification. Original Phase 0–6 suites also pass in a JavaScript harness.
- Run in the repo: `node --test tests/phase0-safety.test.cjs tests/phase1-workflow.test.cjs tests/phase2-quick-practice.test.cjs tests/phase3-learning-analytics.test.cjs tests/phase4-multilingual-packs.test.cjs tests/phase5-ipad-accessibility.test.cjs tests/phase6-offline-study.test.cjs tests/phase7-safe-sync.test.cjs`.
- Syntax checks and source-level mock tests are **not** real iPad/production acceptance. Keep the PR draft until you have tested the exact workflow above.

Next after this: a separate **Japanese secure synchronization design** (Technical project RLS, cross-project identity, idempotent ledger), then physical iPad sign-off and release review.
