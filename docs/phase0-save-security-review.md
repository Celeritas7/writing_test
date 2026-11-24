# Phase 0 — Writing Test save and grader-key safety

Scope: Celeritas7/writing_test, based on main. Does not merge or deploy the earlier iPad offline PR #5.

## Changes

1. Before sending a Ghost Test, persist a durable IndexedDB draft containing marks, ink, timing, a stable session ID and stable Hub attempt UUIDs. Do not start a network write if local backup fails.
2. Use upsert-by-ID for Hub attempts so retrying after an uncertain network response does not create duplicate attempts.
3. Tag Japanese review history items with the Ghost Test session ID (`sid`). Before applying a review, check for that ID in its existing history and skip already-acknowledged words. Japanese source-read errors now stop the save rather than treating inaccessible data as an empty table.
4. A failed Japanese review or marking operation keeps the draft and marks intact. After a save attempt has begun, markings and replacement sheets are blocked until the same saved attempt is retried. The previous fallback to `japanese_daily_test_log` no longer silently claims a full successful review update.
5. Keep the default PDF download student-safe: PDF plus a separate manifest without `answer` or `worked` data. Private grader keys have a distinct `.grader.json` filename, and must be explicitly requested from the Build screen. Linked-folder exports still send the private key directly into `grader/` and student files into `outbox/`.

## Read-only Supabase access review (November 24, 2026)

**No SQL executed in write mode and no policies changed.** Queried `pg_class.relrowsecurity` and `pg_policies` in the General_apps and Technical projects.

| Project | Tables / policies | Finding |
|---|---|---|
| General_apps | `written_test_attempts` (`wt_attempts_owner`) | RLS on; authenticated owner predicate for read/write (`auth.uid() = user_id`) |
| General_apps | `written_test_batches` (`wt_batches_owner`) | RLS on; authenticated owner predicate for read/write |
| General_apps | `written_test_subjects` (`wt_subjects_rw`) | RLS on, but broad `ALL` policy using `true` for authenticated users; content authoring is not administrator-only |
| General_apps | `written_test_topics` and `written_test_problems` | RLS on, but broad authenticated read and insert; content-editing roles need review before multi-user rollout |
| General_apps | `authentication_mode_user_roles` | RLS on; multiple Chatak/allowlist policies share this table; inspect role-function behavior before any migration |
| Technical | `japanese_user_reviews` (`jur_read`, `jur_insert`, `jur_update`) | **High-risk:** policies permit `anon` and `authenticated` with `true`, bypassing intended per-user restrictions because permissive policies combine by OR |
| Technical | `japanese_user_markings` (`jum_read`, `jum_insert`, `jum_update`) | **High-risk:** same broad permissions as above |
| Technical | `japanese_daily_test_log` | RLS on; ownership-based policy, not suitable as an unverified alternative to a failed review update |

### Required follow-up security work (separate coordinated change)

- Inventory every app accessing these Japanese tables, including Japanese Study, Catalyst, Writing Test, and shared vocabulary consumers.
- Review current auth identities across Technical and General_apps. The Writing Test's direct Japanese requests currently use a publishable/anon role and a configured user ID. A General_apps login **does not by itself authorize** use of a Technical project's user ID.
- Design a verified Technical auth session or secure server-side cross-project bridge; ensure explicit user mapping and owner-scoped RLS before revoking current broad policies. Do not simply delete broad policies without migrating dependent applications.
- Test anon reads and writes are rejected, each signed-in user sees only their own reviews, and all approved applications still work. Take a current database backup before production changes.
- Because the current policies are permissive, this client-side Phase 0 change is **not** a security boundary or a full fix for unauthorized remote access.

## What was tested

`node --test tests/phase0-safety.test.cjs` contains 5 regression checks: first-write/session tracking, duplicate retry, failed-read rejection, durable draft recovery data, and separate private grader download. Those cases were also run against the branch source in an isolated JavaScript harness and all passed.

## Manual acceptance before merge

1. Open an existing Ghost Test online and write a few strokes and marks. Reload before saving; confirm ink and marks restore.
2. Interrupt a Japanese save (simulate failed network) and confirm the sheet remains, markings cannot change after the write starts, and retry uses the same session.
3. Save successfully and inspect `japanese_user_reviews.history` for the new `sid`; repeating the same saved attempt must not increase counters again.
4. Test a Hub Ghost Test with an interrupted save; verify one attempt per ID after retry.
5. On Build with no linked folder, export and inspect Downloads: student PDF and `.json` have no reference answers. The private `.grader.json` appears only after choosing **Download PRIVATE grader answer key**.
6. With a linked folder, inspect `outbox/` and `grader/`: only the latter includes answers, and Cowork can grade using the filename rules in `COWORK_TASK.md`.
7. Verify the offline draft PR #5 still targets `main` separately. Do not merge the offline branch until it has been rebased and tested against Phase 0.

## Limitations

- This is a defensive client-side save guard, not a transactional database ledger. Concurrent writes from multiple devices or history truncated beyond the latest 20 entries still need a server-side idempotency design.
- Already-in-progress legacy drafts have no `sid`; the first Phase 0 retry generates and persists one, but cannot retroactively identify previously committed, untagged attempts.
- The separate private answer download is kept in memory until another export/navigation session; if the tab is fully reloaded before it is downloaded, regenerate the batch and download its key separately.
- No physical iPad acceptance tests or end-to-end production save tests were performed here.

No production Supabase changes, deployment, merge or website-data clearing are included.
