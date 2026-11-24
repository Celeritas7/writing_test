# Phase 0 — Supabase access and save-safety audit

**Assessment date:** 2026-11-24
**Scope:** `Celeritas7/writing_test`, General_apps Supabase (`wylxvmkcrexwfpjpbhyy`) and Technical Supabase (`ulgrfumbwjovbjzjiems`).
**Activity:** Read-only policy and source review. **No production SQL, grants, tables, or policies were changed.**

## Confirmed access-control findings

| Project | Table | Confirmed policy behavior | Risk / next action |
|---|---|---|---|
| General_apps | `written_test_attempts`, `written_test_batches` | RLS enabled; authenticated owner predicate `auth.uid() = user_id` for `USING` and `WITH CHECK` | Keep; test two-user isolation |
| General_apps | `written_test_subjects` | RLS enabled, but all authenticated users have an `ALL` policy with `USING true` and `WITH CHECK true` | Any authenticated API client may modify the shared subject catalogue, even without passing the app's UI allowlist |
| General_apps | `written_test_topics`, `written_test_problems` | All authenticated clients can read; INSERT allowed with `WITH CHECK true` | Restrict catalog writes to server-validated editor/admin role; check update/delete behavior separately |
| General_apps | `authentication_mode_user_roles` | Self-read policy matches JWT email; additional Chatak-specific policies also exist | Audit cross-app dependencies before tightening |
| Technical | `japanese_user_reviews` | Owner policy exists **plus** `jur_read`, `jur_insert`, `jur_update` policies allowing `anon` and `authenticated` with unconditional `true` predicates | **Critical:** owner-only policies do not limit access while the permissive policies also apply (RLS permissive policies combine with OR) |
| Technical | `japanese_user_markings` | Same issue through `jum_read`, `jum_insert`, `jum_update` | **Critical:** another API client may read or change records across user IDs |
| Technical | `japanese_unified_words` | Public read appears intended, but anonymous INSERT and broadly allowed UPDATE also exist | Separate shared-vocabulary content integrity risk |
| Technical | `japanese_daily_test_log` | Owner-filtered policy; additional verification of privileges and auth flow needed | Preserve as owner-only |

### Why an immediate RLS patch is not included

`js/ghost_test.js` currently connects to the Technical Japanese project's PostgREST API with a **public anon key** and a configurable `user_id`. It does not present a Technical-project user's authenticated JWT. Removing `jur_*` or `jum_*` permissive policies now would stop Japanese review saving in Writing Test and possibly other existing language apps. Tightening General_apps catalogue write policies may also affect other consumers.

The Phase 0 client changes reduce accidental data loss and prevent silent user-ID omissions, but **they are not a substitute for database authorization**.

## Required staged remediation (separate migration, not deployed)

1. Confirm a fresh, readable backup of **both** projects and obtain a baseline of policy grants, dependent apps, and all writes into the affected tables.
2. Inventory Japanese Study, Writing Test, Catalyst, KG Chart and any other consumers. Identify which use Technical authenticated user JWTs versus only anon keys.
3. Implement an authenticated identity bridge or server-validated API for Writing Test's Technical-project writes. Authorize the learner's owner ID **server-side**; never trust a browser-editable `user_id` by itself.
4. Stage RLS changes so Japanese review and marking SELECT/INSERT/UPDATE/DELETE are authorized by `auth.uid()` matching the record owner, with appropriate `USING` and `WITH CHECK`. Remove unconditional `jur_*` and `jum_*` access only after all affected clients are upgraded.
5. Restrict Writing Test shared catalogue mutations using an authenticated, server-validated editor/admin role. Validate the existing role records and other apps first; do not rely on a client-side `ROLE` variable.
6. Repeat anonymous and cross-user negative tests, offline-to-online retry tests, and multi-app smoke tests in staging. Review security advisors and plan a verified rollback.
7. Obtain explicit deployment approval before modifying production permissions.

## Phase 0 code safeguards in this PR

- Ghost Test writes its stable `saveId` and matching session owner to IndexedDB before sending Japanese review updates. Retries find the same ID in `history[].sid` and skip updates already committed.
- A failure to read existing reviews, missing Japanese credentials, invalid user UUID, or failed write leaves the sheet intact, instead of clearing it on a misleading success path.
- The optional legacy `japanese_daily_test_log` fallback is not used to claim that the primary review update succeeded.
- Automatic browser PDF exports include **only** the student worksheet and answer-free manifest. A private grader key requires a separate explicit action. The linked-folder workflow still places `grader/` and `outbox/` under the same parent, so it **must not** be shared with learners.

## Remaining limitations to verify

- Stable client-side history IDs protect typical retries, **not** concurrent writers or arbitrary tampering: a transactionally enforced server-side idempotency ledger is still recommended before offline synchronization.
- Manually downloaded grader keys stay private only if the user moves/stores them in a restricted location. The linked iCloud root is not itself a security boundary.
- This branch does not change the app's current ability to enter a user ID, authenticate across both projects, or protect already-exposed API endpoints.
- iPad Safari, browser-download behavior and actual multi-user RLS boundaries need real-device/staging acceptance tests.

## Verification commands (read-only)

In each relevant project SQL editor, inspect `pg_policies` and `pg_class.relrowsecurity` for the specific tables above. Also inspect `information_schema.role_table_grants`, confirm whether public/anon/authenticated have Data API grants, and test a legitimate user as well as a different user in staging. These are checks, **not** instructions to run production policy changes.
