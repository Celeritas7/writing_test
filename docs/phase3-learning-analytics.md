# Phase 3 — Learning analytics, mistake patterns, and progress reports

Repository: Celeritas7/writing_test. Baseline: current `main` after merged Phase 2 PR #9.

## Added

- **Analytics** screen on desktop. On small phones/iPads it is accessible from Home → **Learning trends** or Review → **View learning analytics**, keeping the existing six-tab bottom bar.
- 7/30/90-day reporting windows, subject filter, and activity chart with an accessible exact-count table.
- Separate **Cowork graded**, **Quick Practice self-rated**, **Hub Ghost Test**, and **Other/legacy** performance. Historical `graded_by='claude'` counts with Cowork graded. Rates count `correct===true` as successful and use only records with explicit boolean correctness; a partial self-rating is not counted as fully correct.
- Current Library coverage = distinct questions ever attempted / current questions. This is **not a mastery score**.
- Current weak/due/new status derived using the same problem status calculation as the Library. Focus list highlights current weak/due items, repeated mistakes, and the latest available Cowork feedback (without inferring error types from free text).
- Topic progress lists total questions, ever attempted, attempts in selected window, current weak/due, and a Quick Practice link. Focus links open the corresponding topic in Quick Practice with the appropriate mode, or Build for a PDF.
- A text report summarizing methods, activity, subjects, topics and practice priorities; it excludes raw answers, worked solutions, service keys, and detailed free-text notes.
- **Refresh complete history** pages through authenticated `written_test_attempts` with stable timestamp/ID ordering, up to 10,000 rows. On errors or exceeding the limit the existing in-memory history is left in place and an error is displayed. There are no database writes.
- The Home screen now labels its combined seven-day number as **mixed assessment methods**, with a link to the separated breakdown.

## Provenance and limits

- Analytics uses Writing Test's existing `written_test_attempts` and Library rows; it does **not** read or modify the Japanese Study Technical project's tables. Japanese Ghost Test sessions stored only in browser local storage are not included (those entries are not an account-scoped, cross-device history).
- Graded results and self-ratings are not equivalent. Do not compare their percentages as though both were independently assessed.
- Correctness trends are withheld when either compared period has fewer than five marked answers; activity counts remain visible.
- Repeated incorrect marks are counted over the last 90 local calendar days, regardless of the selected 7/30/90 report period, and only for the selected subject.
- Deleted/unknown questions are excluded from per-topic and subject metrics. Duplicate attempt IDs, invalid dates and future timestamps are excluded. Percentages with no data show a dash instead of dividing by zero.
- The initial view uses already loaded app history and may be incomplete due to the Supabase per-request row cap; **Refresh complete history** checks additional pages. A later phase could add server-side reporting for histories above 10,000 records or for strict simultaneous-write snapshots.
- RLS is relied upon for learner-specific attempts. No new authentication or role policies are introduced. The Japanese project's earlier permissive RLS finding is outside this phase and remains to be coordinated separately.

## Acceptance checklist — before merging

1. Open the preview on desktop and iPad. From Home tap **Learning trends**. Confirm all sections fit, charts scroll when needed, and the existing six phone navigation tabs remain usable.
2. Test each 7-, 30-, and 90-day window; check actual counts against a small known set of attempts. Confirm the activity totals match the reported attempt count.
3. Switch between All subjects and individual subjects. Check that unrelated topics and attempts disappear.
4. Compare Cowork, Quick Practice and Hub Ghost Test: they must have separate labels and denominators. Legacy records should be described as such rather than silently mixed into Cowork.
5. For an item missed at least twice, inspect its current status, latest feedback note and priority order. Verify that content is escaped rather than interpreted as HTML.
6. Select a weak or due Focus item and tap **Quick Practice topic**; confirm the correct topic and practice mode. If a Quick Practice session is already underway, it must be preserved and shown rather than replaced.
7. Tap **Build worksheet** from Focus and check the selected topic and existing PDF workflow.
8. Refresh history. Confirm data is retrieved without any insert/update/delete operations. Simulate a network error; existing results must remain visible with a clear warning.
9. Download the text report and inspect its subject names, date range and source statistics. Confirm it contains **no reference answers or private grader JSON**, and no detailed Cowork notes.
10. Confirm empty subject/no-history screens show useful zero states and no NaN percentages.
11. Run `node --test tests/phase0-safety.test.cjs tests/phase1-workflow.test.cjs tests/phase2-quick-practice.test.cjs tests/phase3-learning-analytics.test.cjs` in the repository.

## Not included

- No new database tables, server-side analytics jobs, email reports, or production SQL migrations.
- No deployment, merge, website storage clearing, or modification of offline PR #5.
- No automatic diagnosis of mistake categories from unstructured notes. A future opt-in categorization scheme should use trustworthy labels and human review.
- iPad Safari and live database refresh still need real-device/integration testing. Automated checks are hermetic source-level checks.

## Next

Phase 4 — Multilingual handwriting and shared vocabulary integration, followed by UI/iPad review and the later offline reliability phases.
