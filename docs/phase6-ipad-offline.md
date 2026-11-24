# Phase 6 — Reliable offline startup on iPad (reconciled with old PR #5)

Repository: `Celeritas7/writing_test`. Base: current `main` after merged Phase 5 PR #12. **Phase 6 does not cherry-pick or merge PR #5.** Its original `wt-ipad-offline-v1` IndexedDB schema and useful download/retry ideas have been reviewed and retained in a new feature branch, while all later Phases 0–5 remain present.

## What's included

- Settings → **Download study offline** downloads the current complete app shell, its pinned Supabase/jsPDF libraries, PDF font and the signed-in learner's currently loaded Library, topics, problems, attempts and batches into the existing `wt-ipad-offline-v1` IndexedDB stores. The downloaded snapshot is versioned. Nothing writes to Supabase during an offline download; the learner must first be authenticated and allowed online.
- Per-asset download progress includes file count, files remaining and MB saved. Interrupted downloads preserve already cached files, and retrying resumes missing files. **Ready offline** is reported only after all required assets are cached AND a full current-version verified account snapshot exists.
- Offline startup works after airplane mode, and has a bounded fallback for the case in which Wi-Fi appears connected but Supabase does not respond. Live allowlist checks are skipped only for an explicitly downloaded offline pack. The device-local opt-in survives an expired browser token but is locked after the learner chooses Sign out/Lock offline access. An actively logged-in *different* owner cannot open the previous owner's pack.
- The Service Worker no longer deletes old cache namespaces on update. It serves the complete current app shell from cache, uses a bounded navigation network timeout and never caches Supabase user APIs, access tokens, OAuth callbacks or private service-role keys. Akatsuki broadcaster and Google Fonts are optional and nonblocking.
- The current Home, Library, Review, Analytics and Quick Practice screens can open from saved Hub data. Existing Unicode/multilingual local packs and Japanese/Hub writing drafts remain in their original IndexedDB stores; there is no data clearing or destructive migration.
- The most recently opened Japanese project sheet can be explicitly **downloaded** online and reopened offline via Ghost Test → **Saved Japanese sheet**. It can be written with Apple Pencil while offline; downloading another sheet replaces only the old saved-sheet *content*, not any pending results.
- Offline Hub Ghost Test, Japanese Ghost Test and Quick Practice results are saved into a private local pending-result queue with stable IDs. Original Pencil strokes, marks and per-word times are retained in a pending Ghost record. An apparent Wi-Fi connection followed by a server write error also falls back to local queueing, without claiming an online save succeeded.
- Quick Practice can finish one offline session and start another; local records carry `pending_local` and are distinguished from synced attempts in Review. The Settings **Export pending results** action makes a private JSON backup without deleting or acknowledging anything.
- Online-only operations such as editing the Library, PDF batch publishing, batch status changes, Japanese-project live browsing, and live analytics refresh are blocked or disabled in offline mode. Reconnection is an explicit reload after the user confirms it; there is no mid-writing automatic page switch.

## iPad acceptance steps — must be performed before merge/deployment

1. **Save existing drafts first.** On your iPad, open the app you actually use (Safari tab or Home Screen PWA) while connected to Wi-Fi. Do **not** clear website data, remove the Home Screen icon, delete caches or uninstall. If possible export important outstanding results before changing versions.
2. Confirm the app has finished updating: the new **Settings → Study offline on iPad** card should be visible. If the Download button says the Service Worker is not controlling the page, reopen the same Home Screen app while still online and try again.
3. Tap **Download study offline**. Observe the number of files, files remaining and MB. When complete, confirm the status says **Ready offline**, contains the expected number of questions and shows the last update date. Check that existing Quick Practice and language packs still open online.
4. Interrupt one download (turn off Wi-Fi midway or close the app) and retry while online. Remaining cached files should be reused. A partial download must **not** replace the previously complete pack or report Ready.
5. From Ghost Test, open an online Japanese database sheet and tap **Download this Japanese sheet offline**. Check that the confirmation says how many words were saved. Multilingual JSON packs already imported should remain present.
6. Turn on Airplane Mode and explicitly disable Wi-Fi and cellular data. **Fully close and reopen the same Home Screen app**. Confirm Home, Library, Review and Analytics display downloaded data instead of the login or `Couldn't load your data` screen.
7. Open Ghost Test → **Saved Japanese sheet**. Draw with Apple Pencil, turn the iPad to landscape and back, mark a word correct/partly/wrong, and tap **Save results**. Expect **Saved on iPad · sync pending**. Do the same for a Hub language topic.
8. Complete two separate Quick Practice sessions offline, including typed/Scribble answers. Confirm you can start the second, progress is restored on relaunch and Results remain **pending sync**, not falsely shown as cloud-synced.
9. In Settings, check pending-session count and tap **Export pending results**. Save the private JSON somewhere safe outside the app's cache. Inspect that the export contains stable session IDs and Pencil marks. Export must not clear pending sessions.
10. Reopen the app again in airplane mode and confirm the queued results, Library, Japanese sheet and your existing multilingual packs are still available. Try a downloaded Hub topic whose prompt contains non-Latin symbols.
11. Restore internet. In offline mode use **Reconnect online**, confirm the warning and reload. Supabase should reverify the current account; the offline pending count should remain. **Phase 6 does not automatically synchronize these queued results.** Never delete them just because the network is back.
12. Sign out/Lock offline access on a test device. The offline pack should no longer open automatically, while its underlying bytes remain preserved. Sign back in and download again to reactivate access. On a different account, the previous owner's pack must not appear.
13. Repeat in Safari browser versus Home Screen installation. iPadOS may maintain separate storage for each; **Ready offline** must be tested inside the installation you will open without internet.
14. If the iPad appears 'online' while Supabase is unreachable, wait for the bounded fallback and check the downloaded pack loads without accidentally signing the account out. Test with a poor Wi-Fi connection rather than only airplane mode.
15. Verify PDF Build, Cowork grading, Japanese database browsing, Quick Practice, Analytics and Ghost Test still behave normally in online mode; check app updates do not silently delete any stored data.

## What Phase 6 does **not** do

- It **does not sync** pending results to either General_apps or Technical Supabase; the old PR #5 replay of Japanese aggregated reviews is deliberately excluded to prevent double counting. **Phase 7** will design conflict-safe synchronization with verification, idempotency, progress and recovery.
- It does not automatically download the entire Technical/Japanese database or every vocabulary level; the most recently selected Japanese sheet is one explicit pack. The main Hub Library snapshot reflects whatever the authenticated app currently loaded, subject to existing Supabase page limits.
- It does not encrypt local IndexedDB data or provide an authorization guarantee when a device is stolen/shared. Offline access is an explicit convenience on a trusted personal device; a server cannot instantly revoke downloaded data while that device has no network.
- It cannot guarantee persistence if iPadOS evicts origin storage. Keep private exported backups of unsent work and do not clear browser data.
- It does not change a deployed public website, PWA settings, Supabase schema, RLS, production records or old PR #5. A separate **draft PR** is required for review.

## Verification run

Tests: `node --test tests/phase0-safety.test.cjs tests/phase1-workflow.test.cjs tests/phase2-quick-practice.test.cjs tests/phase3-learning-analytics.test.cjs tests/phase4-multilingual-packs.test.cjs tests/phase5-ipad-accessibility.test.cjs tests/phase6-offline-study.test.cjs`.

Phase 6 tests mock IndexedDB, CacheStorage, offline enrollments, account switching, old-schema preservation, interrupted downloads and pending queues. Prior phases still have source-level regression coverage. A Node/JavaScript simulation **does not prove** the real iPad PWA, service-worker/third-party CDN behavior, Apple Pencil or OAuth refresh will work; hardware acceptance above is mandatory before promoting the draft.

## Pending architectural review

- Reconcile/close the superseded **unmerged PR #5** only after explicit approval; do not merge both branches.
- Before Phase 7, take a backup and audit the General_apps `written_test_attempts` owner policy and Japanese project's permissive review policies. Pending Japanese results need an authorized, idempotent endpoint; a client-supplied Japanese user ID is not sufficient.
- The downloaded Hub snapshot is read-only. Avoid overwriting newer server data with stale cached content when reconnecting, and reconcile by stable attempt IDs only.

Next: Phase 7 — pending synchronization, conflict handling, backups and actual airplane-mode acceptance sign-off.
