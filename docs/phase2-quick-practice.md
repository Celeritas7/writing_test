# Phase 2 — Quick Practice (pre-offline roadmap)

Repository: Celeritas7/writing_test. Based on main after the Phase 1 PDF/grading merge. This change does not include offline PR #5.

## Features

- Quick Practice entry from Home (visible on iPad/phone) and Build; dedicated sidebar link on desktop. The existing six-tab bottom bar remains intact on small screens.
- Choose **Due today** (weak + due), **Weak spots**, **New questions**, or **Surprise me** (shuffled mix), filtered by subject and topic.
- Choose a **5-, 10-, or 20-minute** time goal. The app selects up to one question per minute; the clock is not a forced cutoff. Only questions with non-empty prompts are eligible. Questions lacking a reference answer are clearly labelled for self-assessment.
- One question at a time; type an optional response (including iPadOS Scribble), or solve externally. Reveal the saved answer before rating it ✓ Correct, △ Almost, or ✗ Wrong. Includes Pause/Resume, Previous, Next and Skip.
- Timers pause when the tab is hidden or when the learner leaves Quick Practice. Reloading opens the saved session paused, without charging time spent away.
- Each active session and its scratch response are saved to account-scoped IndexedDB. Ratings use stable per-attempt UUIDs to avoid duplicate results after a failed network response.
- **Finish and save** explains that ratings are self-assessed (not AI or Cowork grades), and excludes unrated/skipped questions. Saves to existing `written_test_attempts` with `graded_by='self'`; no schema changes needed.
- An unconfirmed save becomes **pending** and is locked against changes. The learner can **Retry save** when the connection returns, or **Export pending backup** as private JSON. The pending draft is not silently deleted.
- In Demo mode no results are sent to Supabase or saved to IndexedDB.

## Manual iPad acceptance (required before merge)

1. Open the deployed preview branch on iPad Safari after logging in. From Home, tap **Quick Practice**. Confirm the bottom navigation still fits and Ghost Test/Build remain reachable.
2. Select each mode, switch subject and topic, and inspect the available-question count. Weak should not include new questions; Due today should include weak and due only; New should exclude previously attempted questions.
3. Choose 5, 10 and 20 minutes. Start a session, type a response (try iPad Scribble), reveal the answer, then rate correct/almost/wrong. Check the expected question and rating counts.
4. Pause and resume. Move to a different tab and come back; the timer should be paused, not counting study time away.
5. Reload Safari mid-session. Confirm question order, typed answer, revealed state, ratings and remaining time recover and the clock starts paused.
6. Try Previous, Next and Skip. Confirm unrated questions are excluded from a partial finish, and a warning appears before self-ratings are committed.
7. Simulate network failure on Finish and save. The session should display **Results NOT synced**, remain in pending state, and offer Retry save / Export pending backup. Export should contain stable UUIDs but no private reference answer fields.
8. Restore internet and Retry save. Check that self-rated attempts appear once in Review and that repeated retries do not create duplicates.
9. On a second account in the same browser, confirm Quick Practice does not display another learner's session (account-scoped IndexedDB keys).
10. Open Build and Ghost Test again, test an ordinary PDF export, and confirm prior Phase 0 and 1 functionality still works.

## Automated checks

- `node --test tests/phase2-quick-practice.test.cjs` covers mode selection, strict subject/topic filtering, timebox caps, deterministic session IDs, self-rating metadata, pending-save retry, source safety and syntax.
- Run the Phase 0 and Phase 1 regression suites as well.
- Automated tests use in-memory mocks and do **not** establish an end-to-end iPad, OAuth, or Supabase deployment result.

## Limitations

- Quick Practice is an answer reveal and **self-rating** experience. It is not an AI grader and does not provide an in-app freehand canvas. For Apple Pencil freehand use Ghost Test, or write on a PDF.
- A Quick Practice draft stored in IndexedDB is browser/device-specific and may be evicted by iPadOS. Export pending backups before clearing site data.
- This phase does not implement offline sign-in or downloaded study packs. PR #5 must be revisited only after the pre-offline features are merged.
- The JavaScript client writes through existing signed-in Supabase access and owner-protected RLS. Do not introduce production schema or policy changes as part of this PR.

## Next

Phase 3: learning analytics, progress trends, mistake patterns and actionable review reports.
