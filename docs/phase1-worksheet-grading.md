# Phase 1 — PDF worksheet and grading handoff

Repository: Celeritas7/writing_test. Based on current main after merged Phase 0 PR #7.

## What changed

- Build a batch offers A4 (default, suitable in Japan) or US Letter. The selection persists on the same device.
- PDF export paginates arbitrarily long prompts and GIVEN data across continuation pages. Each page retains the batch and problem identity in its footer; at least one full writing area is left at the end of each problem.
- Missing Unicode/Noto font now aborts the export rather than producing unreadable Japanese/math characters.
- New filename prefix `WT2_` and `manifest_version: 2` distinguish the new grading contract from old batches. The filename includes the batch UUID prefix to avoid collisions when exporting in the same minute.
- Student manifest contains questions without `answer` or `worked`. The separate private grading manifest includes those values and a stable per-problem `attempt_id` (RFC 9562 version 8 UUID derived from SHA-256 of batch UUID and question ID).
- Upserting a grading result with its expected attempt_id avoids duplicate rows when Cowork retries a job. The grader must use POST on_conflict=id with Prefer: resolution=merge-duplicates.
- Batch records are inserted into Supabase BEFORE publishing student files. Failure to record a batch stops the handoff.
- Linked export writes private grader JSON and student JSON before writing the student PDF, reducing incomplete-file triggers.
- iPad Safari download fallback has separate PDF/manifest re-download actions, because multiple automatic downloads may be blocked.
- Existing users can choose Update grading instructions in Settings to replace the old local COWORK_TASK.md without relinking their folder.
- Review has Refresh feedback, Check feedback (new batches), and guarded Confirm graded after all expected Cowork attempts are found. The solved confirmation explains that the iPad Files move must be done manually.
- Old WT_ batches preserve their manual workflow; the new stable-ID check is not applied to legacy batches.

## Manual acceptance — do not merge until reviewed

1. On desktop or iPad, build one A4 worksheet with Japanese text, maths symbols, and at least one long question; inspect the PDF in Preview/Files. No clipped lines, text overlap, missing glyphs, or pages without footers.
2. Repeat in US Letter. Check a long GIVEN data section, and confirm every question has sufficient writing space and the answer area.
3. Export with no linked folder on iPad Safari. Confirm the PDF and student-safe `.json` contain no reference answers. If Safari blocks a file, use PDF again / Student manifest again.
4. Explicitly download the PRIVATE `.grader.json`; inspect that it contains `answer`, `worked` and a distinct `attempt_id` for each problem. Ensure it is in grader/, NOT outbox/.
5. With a linked folder in desktop Chrome/Edge, export; inspect outbox/ and grader/. Grader JSON must exist, and the student PDF must not be published before its support manifests.
6. In Settings choose Update grading instructions to refresh COWORK_TASK.md. Confirm it names manifest_version=2, stable attempt IDs and verification before marking graded.
7. On iPad annotate the PDF with Apple Pencil in Files/Markup, save it to solved/, and in Review select I saved it in solved/.
8. Before grading, Check feedback must show 0/N and leave Confirm graded disabled. A partial grader run should show e.g. 2/N and still prevent grading.
9. Once all N correct Cowork attempt IDs have been saved, Check feedback must show N/N and allow Confirm graded. Refresh feedback should load all notes and batch status.
10. Run the grader a second time against the same manifest. No additional attempt rows should appear; only the same stable UUID records should be updated.
11. Open an old WT_ batch and check manual status changes remain possible. Make sure offline draft PR #5 remains separate.

## Test coverage

- `tests/phase0-safety.test.cjs`: save retry, draft and private-key protections.
- `tests/phase1-workflow.test.cjs`: student/grader separation, deterministic distinct UUIDs, matching Cowork coverage, long-input A4/Letter pagination with a jsPDF stub, grader gates, linked write ordering and syntax.
- These tests are hermetic and do NOT establish physical iPad/iCloud/Cowork integration. Actual PDF rendering still needs Preview/Safari inspection.

## Limitations / follow-up

- Linked folder control is unavailable in Safari on iPad; PDF and manifest still require manual transfer using Files.
- Neither the app nor this PR can detect whether a learner truly moved the PDF into solved/. The learner must confirm the move.
- Existing older batches have no stable attempt ID contract; manual grading remains.
- New per-batch verification depends on Cowork writing the `attempt_id` and `graded_by='cowork'` values from the private v2 manifest.
- The current grading handoff still involves a privileged local service-role key; production-grade multi-user deployment should move to a narrowly scoped authorized server-side flow.
- No database migration or production Supabase mutation, deployment, or merge is part of this PR.

## Next

Phase 2: Quick Practice modes and fast test controls. Later offline work should rebase PR #5 after this work is merged and verified.
