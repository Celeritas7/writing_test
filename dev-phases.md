# Learning Hub — development phases

Each phase is one loop:

1. **Build** — Claude Code makes the changes on a branch, runs the checks, screenshots every affected screen at 1280px and 390px, and pushes.
2. **Design review** — the Claude design skills look at the result (`/design:design-critique` for the screens, `/design:accessibility-review` where noted, `/design:ux-copy` for wording) and return a list of changes.
3. **Rework** — Claude Code applies the review, re-screenshots, pushes. Then the phase is merged.

Phases are ordered so each one leaves a working app.

**Status (2026-10-19):** all nine phases are built on branch `ccr-4abfed3a-grkuod`, one commit each ("Phase N: …"). Design review round 1 (2026-10-20) ran with `/design:design-critique`, `/design:accessibility-review` and `/design:ux-copy` on screenshots of every screen at 1280px and 390px; its findings and fixes are in the section at the end. Round 2 should happen on a real iPad.

---

## Design review — round 1 (2026-10-20)

Reviewed from screenshots of every screen (demo data) at 1280px and 390px. Severity: 🔴 blocks use · 🟡 hurts use · 🟢 polish. Everything marked **fixed** is in commit "Design review round 1".

### Critique findings
| # | Phase | Finding | Sev | Outcome |
|---|---|---|---|---|
| 1 | 4 | Box paper wrapped words mid-word ("生え / る") because the mark reserved width in the tab row | 🔴 | **fixed** — the mark now sits inside the number tab; the word keeps its line |
| 2 | 2 | Setup on a phone: long monospace paths overflowed the card and were clipped | 🔴 | **fixed** — paths wrap anywhere on phones |
| 3 | 6 | Review on a phone: the batch table clipped its Status column, the one that matters | 🟡 | **fixed** — Topic and Problems columns hide on phones; file name wraps |
| 4 | 4 | Phone pen bar is cut off with no sign it scrolls | 🟡 | **fixed** — right-edge fade, same as the nav |
| 5 | 4 | Toasts cover Save / Exit on phones | 🟡 | **fixed** — toasts sit above the drawer in the ghost view |
| 6 | 2 | "not linked" in red reads as an error on first run | 🟡 | **fixed** — amber "Not linked yet" |
| 7 | 4 | "◐ Ghost" does not say what it toggles | 🟡 | **fixed** — "◐ Show key" |
| 8 | 7 | Home's secondary button "Ghost test" is a noun, not an action | 🟢 | **fixed** — "Write a sheet" |
| 9 | 4 | Ending list showed "—" where a hub sheet has no next date | 🟢 | **fixed** — blank |
| 10 | 8 | Library subject row on a phone wraps ✎ 🗑 + Topic ▸ onto two lines | 🟢 | open — acceptable; revisit with a real device |
| 11 | 4 | Full screen on a laptop still shows the paper "名前 ____" name line | 🟢 | open — harmless |
| 12 | 6 | Feedback card header wraps stars to a second line on phones | 🟢 | open — acceptable |

### Accessibility audit (WCAG 2.1 AA)
| # | Issue | Criterion | Sev | Outcome |
|---|---|---|---|---|
| 1 | Muted text (`--mute` #7a857e) was 3.4:1 on the page background — kickers, dates, hints | 1.4.3 | 🔴 | **fixed** — #636d67 (4.8:1 / 5.4:1 on cards) |
| 2 | Amber chips: white on #b3811e was 3.3:1; warm-up chip text 3.2:1 | 1.4.3 | 🔴 | **fixed** — #8a6212 (5.5:1 / 5.0:1) |
| 3 | Sidebar links were not inside a navigation landmark | 1.3.1 | 🟡 | **fixed** — `role="navigation"`, labelled |
| 4 | Ink canvas had no accessible name | 1.1.1 | 🟡 | **fixed** — role img + label |
| 5 | Focus ring relied on browser default; inconsistent across buttons, pills, inputs | 2.4.7 | 🟡 | **fixed** — one 2px accent ring on `:focus-visible` |
| 6 | Browser `confirm()` dialogs cannot label their buttons ("OK/Cancel") | 3.3 | 🟢 | open — replace with an in-page dialog in a later phase |
| 7 | Not verifiable from screenshots: VoiceOver on iPad, 200 % zoom | — | — | to test on device |

Already in place from Phase 8a: keyboard reach for every click target, labels tied to fields, aria-pressed on toggles, live-region toast, 44px targets, AA-passing △.

### UX copy
| Element | Before | After |
|---|---|---|
| Ghost key toggle | ◐ Ghost | ◐ Show key |
| Home secondary CTA | Ghost test | Write a sheet |
| Setup folder state | not linked (red) | Not linked yet (amber) |
| Rest ✓ | — | tooltip "Mark every unmarked item ✓" |

Kept as is: "Build a batch", "Save results", "Practise again", "Retry the N wrong", "Couldn't load your data" + Retry, the unmarked-items confirm — all verb-first and specific.
 Item numbers (A1, B5 …) refer to `deep-review.md`.

---

## Phase 1 — Stop the breakage — ✅ built, awaiting design review (small, mechanical)
Items: A1, A2, A7, A8, A9, A10, A14, A19, B19.

**Claude Code builds**
- `route()` guards on "data not loaded", not "no topics"; empty Library state with a + Subject prompt.
- One `admit()` in flight at a time.
- Ghost: clear `GH.locked` when a set loads; `ghInit` calls `ghScore()` so the counter never resets.
- Shortcuts only fire while the ghost view is active.
- Busy state on Save results / Export PDF / Add subject / Add topic / Add problem (button disabled, spinner text, re-enabled on error).
- Clamp ratings to 0–5; pin `supabase-js` and show a message if it fails to load.
- Fix every `sql/…` message, or commit the SQL files.

**Design review checks**
- Empty states (no subjects, no topics, no problems) read well and point to the next action.
- Busy/disabled button styling is consistent across the app.

**Done when** a fresh demo account can create subject → topic → problem → batch without a reload, and the ghost sheet never shows a counter that disagrees with the marks.

---

## Phase 2 — Make the loop reliable — ✅ built, awaiting design review
Items: A5, A6, A11, A12, A15, B2, B4.

**Claude Code builds**
- Download path also produces the manifest (or one zip); batch row is only inserted after both files exist.
- Setup gets **Reconnect folder** (calls `requestPermission()`), plus a persistent banner when the stored folder needs it.
- Ghost: a failed save keeps the sheet and offers Retry; ink, marks, times and the loaded set are saved as a local draft (IndexedDB) and restored for 7 days.
- Load failure shows a persistent error card with Retry instead of a vanishing toast.
- Build de-prioritises problems that are in an exported-but-ungraded batch and labels them "in batch".
- Manifest written to the iPad folder no longer contains answers (answers go to a `grader/` file outside `outbox/`).

**Design review checks** (`design-critique`, `ux-copy`)
- Error, retry and "draft restored" messages: tone, placement, clarity.
- Setup page flow now that it has link / reconnect / not-linked states.

**Done when** killing the tab mid-sheet and reopening restores the sheet; exporting with no folder linked yields a gradeable pair of files; a reload keeps the folder linked.

---

## Phase 3 — PDF that prints everything — ✅ built, awaiting design review
Items: A3, A4, B18, and the `given_data` wrap bug.

**Claude Code builds**
- Embed Noto Sans JP (subset) via `doc.addFont`; use it for prompt, given, answer and header.
- Page-overflow handling: long prompts flow to a continuation page; the work grid always gets a minimum height.
- Wrap width computed with the font that is actually drawn; local-time filename.

**Design review checks** (`design-critique` on rendered pages)
- Typography and spacing of the PDF for Latin, Japanese and maths-heavy prompts.
- Header collision when topic name and subtitle are both long.

**Done when** a Language-study batch and a 600-character calculus prompt both render correctly in Preview on iPad.

---

## Phase 4 — Ghost test writing feel — ✅ built, awaiting design review
Items: B1, B6, B7, B8, B9, B15, B16, B20, B22, A17, A18.

**Claude Code builds**
- Desktop full screen fits the grid to the viewport with the *largest* cells that fit (not a one-line strip).
- Phone full screen: canvas covers the full scroll height.
- Dot strokes for single-point taps; strokes stored in cell-relative 0–1 coordinates so they scale on reflow/rotation.
- Timestamp-based timer, cleared on route change; listeners removed on re-render.
- "Unmarked items — save anyway?" confirm; marking mode shows a "tap ✓ again to write" hint; Undo moved beside the pen tools.
- Timing label no longer overlaps the word.
- Test the mixed known/new upsert against the live PostgREST; send uniform keys.

**Design review checks** (`design-critique`, `accessibility-review`)
- Full-screen layouts at iPad landscape, iPad portrait, phone.
- Toolbar grouping (writing tools vs view settings) and the drawer on phones.
- Mark target sizes (≥44 px), △ colour contrast, seconds label legibility.

**Done when** a 20-word sheet is writable in every orientation, rotation keeps ink in its cell, and the design review signs off the toolbar.

---

## Phase 5 — Dates, streak, identity — ✅ built, awaiting design review
Items: A13, B10, B11, B12, A16.

**Claude Code builds**
- All stored dates in local calendar day (one `today()` helper); migrate existing `next_review` values once.
- Streak from a per-session log table instead of `last_review`.
- Drop the hard-coded `JP_USER_ID`; filter every `japanese_user_reviews` read/write by the signed-in user; Connection settings actually apply.
- Allowlist lookup uses `eq` on a lower-cased column.
- Phase 3 endings match `phases.md` thresholds (18–19 of 20 → check; proportional for smaller sheets).

**Design review checks** (`ux-copy`)
- Wording of the three endings and the streak/due line.

**Done when** a 07:00 JST session logs as today, the streak survives re-reviewing yesterday's words, and a second test user cannot touch the first user's rows.

---

## Phase 6 — Review and results — ✅ built, awaiting design review
Items: B5, D4, D5, B17.

**Claude Code builds**
- One card per ghost session ("Kanji N5 · 19/20 · 1 to review") expandable to the word list; JP-database sessions also appear.
- Batch rows open: PDF link, attempts, mark solved/graded manually.
- Filters: topic, batch, wrong only; "showing newest 30 · load more".
- "Practise again" on a wrong answer → pre-filled Build / ghost retry sheet from the wrong list.
- `.chip.review` style.

**Design review checks** (`design-critique`)
- Card hierarchy, filter bar, star rating legibility, empty states.

**Done when** a learner can go from a wrong answer to a new sheet containing it in two taps.

---

## Phase 7 — Dashboard (phases.md Phase 4) — ✅ built, awaiting design review
Items: D6, D7.

**Claude Code builds**
- Phone-first home: due-today count + Start, streak, accuracy, last session's marks.
- Becomes the default route on phones; Library stays default on desktop.
- Demo mode shows an exported batch in Review and no `!` badge.

**Design review checks** (`design-critique`, `accessibility-review`)
- 390 px layout, tap targets, number hierarchy, dark-mode readiness.

**Done when** the dashboard is usable at 390 px with no horizontal scroll and every number on it links somewhere.

---

## Phase 8 — Accessibility and content editing — ✅ built, awaiting design review
Items: C1–C7, D1, D2, B13, B14.

**Claude Code builds**
- Clickable divs become buttons/links with `role`, `tabindex`, key handlers; labels tied to inputs; `aria-pressed` on toggles; `aria-live` on toast and gate message; Ctrl/Cmd+Z and a shortcuts help sheet.
- Edit / delete / reorder for subjects, topics and problems; multi-line prompts with LaTeX preview.
- Slug collisions and empty slugs handled; orphaned topics listed under "Unsorted".

**Design review checks** (`accessibility-review` full audit, `design-system` for naming consistency)
- WCAG 2.1 AA pass across all screens; component naming and token usage in `learning_hub.css`.

**Done when** the accessibility audit returns no critical or serious issues and every record can be corrected from the UI.

---

## Phase 9 — Clean-up — ✅ built, awaiting design review
Items: E-section, dead code.

- Remove the legacy import panel, `Temp/` folders and `js/Temp/`; fix README and `phases.md` paths; add `sql/` to the repo or document where it lives.
- Design review: final `design-system` pass to document the components actually in use.

---

## Rough sizing

| Phase | Build | Review + rework |
|---|---|---|
| 1 | ½ day | ¼ day |
| 2 | 1 day | ½ day |
| 3 | ½ day | ¼ day |
| 4 | 1–1½ days | ½ day |
| 5 | ½ day | ¼ day |
| 6 | 1 day | ½ day |
| 7 | ½ day | ½ day |
| 8 | 1½ days | ½ day |
| 9 | ¼ day | ¼ day |

Phases 1–3 are independent of each other and can run in parallel branches; 4 and 5 both touch `ghost_test.js` and should go in order; 6 and 7 depend on 5 (dates/streak).
