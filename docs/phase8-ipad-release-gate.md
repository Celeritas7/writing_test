# Phase 8 — iPad Acceptance, Reliability, and Release Gate

Repository: `Celeritas7/writing_test`. Baseline: current `main` following merged Phase 7 PR #14. Phase 8 is performed on `review/phase8-ipad-release-readiness`, without changing production Supabase or deploying a live app.

## Current release verdict

**NO-GO for declaring reliable iPad offline operation until the physical acceptance checks below are completed.** The code and isolated regression tests can pass without proving Safari Home Screen restart, Pencil handwriting, OAuth refresh, synchronization, or storage survival. Do not mark the release accepted solely because diagnostics say that the current assets and pack look complete.

**Japanese cross-project automatic synchronization remains out of scope and disabled** because Technical Japanese reviews and markings need secure identity and idempotent event processing. A limited Hub/Quick offline release must clearly state that Japanese results remain local and require private backup; do not describe Japanese progress as synced.

## Safety rules before testing

- Work only in a controlled review deployment or test installation. A GitHub branch is **not** itself a deployed PWA. A preview on a different origin has different Safari storage and does not prove preservation of data at the current installed origin.
- **Do not clear website data, unregister service workers, remove the Home Screen icon, reset IndexedDB, or delete old cache namespaces.**
- Save any active Ghost Test handwriting before changing builds, and export pending results to a private file outside browser storage.
- Retain the original offline PR #5 unmerged. Never combine its outdated cache/auth code with this branch.
- Do not change production Supabase data or RLS to simulate failures. Create conflict test fixtures only in a separate staging project/environment.
- For release upgrade tests, preserve the **same origin and installation**; compare pre/post data. If a staging deployment has a new origin, treat it as a fresh-install test instead.

## Code changes in Phase 8

- New `js/release_readiness.js` queries exact row counts and downloads **every page** (400 rows per page) of subjects, topics, problems, attempts, and batches while authenticated. It checks counts, duplicate/malformed IDs, and a conservative maximum of 20,000 rows per table; incomplete reads **cannot overwrite** the previous verified pack.
- Settings → **Run iPad readiness checks** performs read-only checks for service worker control, complete current assets, account-matched pack, source-count verification, pending sessions, receipts, storage estimate, and Home Screen installation. It exports a **sanitized JSON diagnostic report** with counts/status only, not names, account identifiers, answer keys, study notes, tokens, or Pencil strokes.
- The service-worker shell is versioned `lh-v2-phase8` and the explicit download cache is `wt-ipad-assets-phase8`. Prior caches and IndexedDB stores remain untouched. Reopen/download online after this update before airplane-mode testing.
- Installation instructions now clarify that **Add to Home Screen alone is not an offline study download**.

## Acceptance checklist

Use the columns **Result**, **Evidence**, and **Comments** when reporting each check. Record PASS only after observation on the actual device; otherwise use FAIL, BLOCKED, or NOT RUN.

| ID | Physical test | Expected result | Result |
|---|---|---|---|
| P8-01 | Open the review build on iPad Safari while online, sign in, and reopen | The same verified learner can reach Settings, Home, Ghost Test, Quick Practice and Analytics | NOT RUN |
| P8-02 | Install to Home Screen, launch once online and check Settings | Install is separate from downloading; service worker controls the Home Screen app after reopening | NOT RUN |
| P8-03 | Open Settings → Run iPad readiness checks | Service worker/current assets/owner/snapshot state is shown without app data being altered | NOT RUN |
| P8-04 | Open Settings → Download study offline (current version) | Complete count-verified snapshot, correct problem count, progress in files/MB and Ready offline only when complete | NOT RUN |
| P8-05 | Interrupt a download and reconnect | Cached files resume without deleting the old pack; incomplete snapshot does not say Ready | NOT RUN |
| P8-06 | Start airplane mode, turn off Wi-Fi/mobile data, fully close and reopen Home Screen app | Home, Library, Review, Analytics and downloaded topics reopen with no Internet or login loop | NOT RUN |
| P8-07 | Write with Apple Pencil in a saved Hub Ghost Test sheet, rotate and mark answers | Ink stays aligned; palm/second finger does not corrupt strokes; marks and draft survive relaunch | NOT RUN |
| P8-08 | Open a downloaded Japanese sheet and a multilingual JSON pack offline | Unicode renders and writing works; Japanese session says pending locally, not synced | NOT RUN |
| P8-09 | Complete two Quick Practice sessions without Internet | Both sessions are preserved with stable attempt IDs, and pending count increases | NOT RUN |
| P8-10 | Export pending-results JSON while offline, then reopen app | The private file can be saved outside app storage; pending results are unchanged and still visible | NOT RUN |
| P8-11 | Reconnect, reverify account, manually Sync pending Hub/Quick | Existing IDs match or missing rows insert once; server read-back succeeds; receipt issued only for confirmed rows | NOT RUN |
| P8-12 | Simulate uncertain network acknowledgment and retry (safe staging fixture only) | No duplicate rows or overwritten Cowork grades; uncertain/conflicting local jobs remain pending | NOT RUN |
| P8-13 | Enable auto-sync explicitly, reconnect from Home, then disable it | Sync never interrupts active Ghost/Quick page; Japanese sessions remain local; preference can be turned off | NOT RUN |
| P8-14 | Test another signed-in account on a trusted test installation | No other user's downloaded pack/queued sessions show through normal UI; offline lock follows sign-out | NOT RUN |
| P8-15 | Rotate, use VoiceOver, hardware keyboard and larger text | Focus, Ghost Test marks and toolbar remain accessible without hiding required controls | NOT RUN |
| P8-16 | Update a *same-origin* test installation without clearing storage | Older drafts, packs, queued sessions, receipts and previous download bytes remain available; new pack requires explicit refresh | NOT RUN |
| P8-17 | Export Settings → iPad readiness diagnostic JSON | Report excludes email, user ID, tokens, answers, strokes and free-text notes; physical acceptance still NOT VERIFIED | NOT RUN |

## Suggested order for the first iPad session

1. Open the updated installed Home Screen app **online** and sign in. Make a private pending-results backup if any exist.
2. Select **Settings → Download study offline** and confirm the record counts, then **Run iPad readiness checks** and export the sanitized report.
3. Enable Airplane Mode and switch Wi-Fi OFF; force-close and reopen the Home Screen app.
4. Test Library and a saved Japanese/Hub Ghost sheet. Save at least one sheet and one Quick Practice session offline.
5. Export pending results, reopen once more offline, and confirm those sessions remain.
6. Reconnect online and manually synchronize only the Hub/Quick results. Confirm their sync receipts and Japanese-held status.
7. Report the checklist results, screenshots of UI errors if present, and the diagnostic JSON. The report has no answers or credentials but can still reveal device usage counts; share it only where appropriate.

## Acceptance evidence record

Fill this record after physical testing (never assume values from source review):

- Test date and device/iPadOS version: **NOT RUN**
- Launch context: **Safari tab / Home Screen app (to be recorded)**
- App origin and preview/release build identifier: **NOT RECORDED**
- Diagnostic export: **NOT COLLECTED**
- Expected/observed study item count: **NOT RECORDED**
- Before/after pending sessions and receipts: **NOT RECORDED**
- Failed test IDs, symptoms and reproduction steps: **NONE EVALUATED**
- User confirmation that no website data was cleared: **NOT RECORDED**

## GO / NO-GO rules

- **GO for the limited Hub/Quick offline scope** only when all critical P8-01–P8-14 and P8-16 pass on a real Home Screen installation, P8-15 and P8-17 pass, no pending results have been lost, and source code/test runs remain green. Manual Japanese backup/hold restrictions must be clearly communicated.
- **NO-GO** if a required lesson is missing, offline reopen fails, handwritten drafts or pending results vanish, live sync creates duplicate/overwritten grades, the same-origin update loses user data, or the user cannot export local results.
- **NOT IN SCOPE**: claiming full Japanese cross-app synchronization is ready. That requires its own security/schema contract and tests; do not weaken Technical RLS or invent a signed-in identity mapping in Phase 8.
- A passing read-only diagnostic export does **not** by itself satisfy any physical test, nor can it certify that iPadOS will never evict website storage.

## Automated checks

Run: `node --test tests/phase0-safety.test.cjs tests/phase1-workflow.test.cjs tests/phase2-quick-practice.test.cjs tests/phase3-learning-analytics.test.cjs tests/phase4-multilingual-packs.test.cjs tests/phase5-ipad-accessibility.test.cjs tests/phase6-offline-study.test.cjs tests/phase7-safe-sync.test.cjs tests/phase8-release-readiness.test.cjs`.

Phase 8 adds count/pagination/duplicate/failure tests and privacy-safe diagnostic tests. These are **isolated JavaScript tests**, not actual iPad, WebKit, OAuth, Apple Pencil, network transitions or Supabase integration tests.

Current overall decision: **NO-GO / physical acceptance pending.** No deployment, merge, production Supabase mutation or browser-storage clearing is part of this Phase 8 PR.
