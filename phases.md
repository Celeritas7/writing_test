# Ghost test — build phases

One phase per pass. Each ships a working app you can use before the next starts.
Files: `writing_test/ghost_test.js`, `writing_test/learning_hub.html`, `japanese_user_reviews`.

---

## ✅ Phase 0 — done
- Format painter: **Mark by** Tap · ✓ · △ · ✗, drag across items to mark.
- **Rest ✓** fills only unmarked items (never overwrites your ✗ / △).
- **Clear marks** with a confirm; handwriting untouched.
- Marking controls moved to their own bar — fixed to the bottom under 820px.

Delivered as `handoff/ghost_test.js` + `handoff/ghost-mark-bar.css`.

---

## Phase 1 — per-word timing ✅ built
Groundwork for everything after it. No visible UI except a clock icon (icon lands in Phase 2).
- Clock per item: starts when the item gets focus (first stroke in its cell), stops when you leave it.
- Idle cutoff: pauses after **10s with no stroke movement**, so breaks aren't counted.
- Saved to `japanese_user_reviews.seconds` **and** into each `history` entry as `s`.
- On duplicate words in one sheet: worst mark wins (as before), longest time wins.

**Migration — run this in your Japanese project first:**
```sql
alter table japanese_user_reviews add column if not exists seconds int;
```

**Done when** a saved sheet writes a plausible seconds value per word and idle gaps don't inflate it.

---

## Phase 2 — slow-but-correct ladder ✅ built
Depends on Phase 1 data.
- Slow = **> 1.5× the median of that word's last 3 recorded times**.
- No history yet → flat **20s** threshold.
- A slow ✓ advances **half the next interval**, rounded to a ladder step (1 · 2 · 4 · 8 · 16 · 30 · 60 · 120).
- Clock icon on the item so the shorter interval isn't a mystery.

**Done when** a deliberately slow correct answer schedules 4 days where a fast one schedules 8.

Built: `srsHalfStep()` snaps half the interval to the nearest ladder step (ties go shorter, never
longer than the un-halved step). `ghSlowLimit()` reads the last 3 `history[].s` values, medians
them and multiplies by 1.5; empty history falls back to 20s. The sheet fetches those limits once on
mount so the **◷** icon lights live the moment a word crosses its own line, and each history entry
now carries `w:1` when the answer was slow. Save reports e.g. *"3 slow ✓ at half interval (4d, 4d, 8d)"*.

No migration needed — slowness lives in the existing `history` jsonb.

Worked example (step 3 → 4 days going in):
| answer | ladder step after ✓ | scheduled |
|---|---|---|
| fast | 4 | **8 days** |
| slow | 4 → halved to 3 | **4 days** |

---

## Phase 3 — endings
- **Full marks (20/20):** the flower blooms centre-screen over a scrim, solid oxblood, ~2.9s, and blocks the sheet — the test is over, Exit only. Petals meet at the centre, uneven, non-overlapping (geometry is in `templates/ghost-test-20/GhostTest20.dc.html`).
- **18–19 of 20:** a small check, no flower.
- **Anything less:** the wrong ones listed with their next review dates, no mark at all.

**Done when** all three endings fire at the right scores.

---

## Phase 4 — mobile dashboard
Phone-width first, in this order:
1. Due-today count + Start button.
2. Streak and accuracy.
3. Last session's marks, so you see what you got wrong.

**Done when** the dashboard is usable at 390px without horizontal scroll.

---

## Phase 5 — optional
- Port the template's **4×5 box grid** (per-box grid/baseline paper, ghost under faded ink) into the app, replacing the 5-column list layout.
- Standalone export of `templates/ghost-test-20/` to run from `writing_test/`.

---

## Decisions already fixed (don't re-litigate)
- Sets of 20; a ✗ word returns 5 items later; re-inserted mistakes replace later items rather than extending the set.
- Only the worst mark per word counts.
- Sheet layout: 4×5 landscape, 2×10 portrait, one word per screen under 820px.
- One master ghost toggle reveals all 20; your ink fades to 30% while it's shown.
- Ink = normalised stroke points, local only, 7-day resume, scales with the box on reflow.
- Marks stay editable until you exit.
- Flower is ghost-test only for now.
