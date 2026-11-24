# Phase 5 — iPad readiness, UI and accessibility

Repository: `Celeritas7/writing_test`. Start point: merged Phase 4 PR #11 on `main`. This is **pre-offline** work and does not merge the existing draft offline PR #5.

## Code changes

1. **Ghost Test sources remain accessible on narrow screens.** Previously the `max-width:560px` rule hid all `.pillbar` elements in Ghost Test, including Japanese set selectors. It also hid direct `main > p` messages. The desktop-only header is still compacted on phones, but a touch-friendly source bar now offers **Japanese sets**, **Language packs**, and a native **Hub topic** selector. Important language-pack local-storage warnings and source-panel controls remain visible.
2. **One active pointer per handwriting stroke.** The Pencil/finger stroke captures its pointer ID, and unrelated palm or second-finger movements/up events cannot add points to that stroke. A canceled gesture preserves genuine drawn segments but does not invent a dot from an empty cancellation. New strokes, Undo and Clear are blocked during an unacknowledged save or on a locked sheet.
3. **Native marking controls.** Numbered ✓/△/✗ targets are actual buttons instead of a custom clickable span, so VoiceOver activation and standard keyboard activation work. The visible mark's accessible name updates whenever it changes. Toggles expose pressed/expanded states for Pen, Eraser, Finger, paper, grid, key overlay, marking brush, drawer and extra controls.
4. **Keyboard/navigation announcements.** The app has a Skip-to-main button, a focusable main area, a live route announcement, current-page nav semantics and page-specific document title. Hash-route navigation focuses the main area; ordinary view updates do not repeatedly steal focus. Ghost Test keyboard shortcuts ignore form fields, buttons, editable content, ongoing composition and open dialogs.
5. **Quick Practice focus recovery.** The subject/mode/duration picker keeps focus after rerender. Next/Previous/Skip/rating focus the new question heading; Reveal focuses the reference answer region. Progress and rating labels have explicit accessible semantics.
6. **Touch and reduced-motion styling.** Ghost toolbar/source selectors have at least 44px hit targets for coarse pointers, native buttons preserve their previous styling, keyboard focus indicators are visible, and animation effects are minimized with `prefers-reduced-motion`.
7. **App shell refresh.** Service worker version bumped to `lh-v2-phase5` so changed scripts and styles can update in installed PWAs. No cache/data deletion scripts or storage clear are introduced.

## iPad acceptance checklist — required before merge

**Use a deployed review build if possible.** The PR code itself is not the live app. Begin with the iPad connected and signed in. Back up any pending study work; do not clear website data or uninstall the Home Screen app.

### A. Ghost Test and Apple Pencil

1. Open an existing Japanese Ghost Test with the Pencil. Draw one normal word using several strokes. A resting palm or second finger must not connect stray lines to the Pencil stroke.
2. With **Finger** off, drag a finger over the canvas: the page should scroll instead of drawing. With **Finger** on, finger drawing should work. Confirm Pencil still works in both modes.
3. Start a stroke, rotate the iPad or otherwise interrupt a gesture; after orientation settles, confirm completed strokes remain aligned to their question boxes. Short canceled taps should not create stray dots.
4. Use Pen, Eraser, Undo, Clear ink, Show key, grid/plain paper and two-finger undo. Check that toggles visually and accessibly reflect their state.
5. Mark one word ✓, change it to △ and then ✗. Save or simulate a failed save and confirm the handwritten sheet is not editable while awaiting retry, but can be recovered.
6. With iPad in portrait and landscape, verify the marking drawer opens and closes, Save results remains reachable and the fixed bottom tab bar never covers the necessary actions.

### B. Source switching and multilingual content

7. On a narrow phone or browser viewport (560px or less), open Ghost Test while a Hub language topic exists. Verify **Japanese sets**, **Language packs**, and **Hub topic** controls appear. Confirm Japanese set mode/filter pills have not disappeared.
8. Import a Burmese JSON pack from Phase 4; practise a sheet and confirm the **local-only** warning is visible. Repeat with Chinese and Marathi/Devanagari strings and confirm signs, combining characters and fallback fonts render correctly.
9. Verify an unfinished imported-language sheet can still be restored separately from the older Japanese Ghost Test draft.

### C. Keyboard, VoiceOver and assistive settings

10. With a hardware keyboard, Tab through the app. The Skip-to-main control should become visible on focus; activating it should focus the main study region. Navigating to Home, Quick Practice, Ghost or Analytics should announce the new page and update the document title.
11. In iPad Settings enable **VoiceOver**. Navigate to a numbered mark target and double-tap to cycle its mark. Its announced name should change to correct/partly correct/wrong; the pencil canvas remains a separate drawing interaction.
12. In Quick Practice, select a mode and duration using a keyboard. After selecting a filter, focus should remain on that control. After Next or Previous, focus should land on the new question heading; Reveal should focus the reference answer.
13. With VoiceOver on, verify the marking drawer and tool toggles expose their pressed/expanded state. With **Reduce Motion** enabled, animations should stop without hiding content.
14. Verify menus, buttons, feedback, focus outlines and report tables remain usable at larger Dynamic Type/text sizes and 200% browser zoom. Test both normal Safari and the Home Screen PWA.

### D. Compatibility and recovery

15. Repeat a normal Hub Ghost save, a Japanese-source save, a Phase 4 local-only pack save, a Quick Practice partial save, PDF Build export, and Phase 3 Analytics navigation. All existing data-scoped operations must behave as before.
16. Test with an older installed PWA and then load the new version while online. Confirm content updates after relaunch and existing drafts, bookmarks (if any), language packs and unsynced results remain present.
17. On airplane mode, do not claim full offline study is ready yet: that belongs to separate future Phases 6–7, after the draft offline PR is reconciled with current `main`.

## Automated testing and limitations

- `node --test tests/phase0-safety.test.cjs tests/phase1-workflow.test.cjs tests/phase2-quick-practice.test.cjs tests/phase3-learning-analytics.test.cjs tests/phase4-multilingual-packs.test.cjs tests/phase5-ipad-accessibility.test.cjs`.
- New tests cover pointer identity/palm input, pointercancel behavior, pending-save ink lock, VoiceOver marking labels, native buttons, pressed/expanded control state, Quick Practice focus, small-screen source selectors, navigation status, reduced motion and code syntax.
- Tests use an isolated JavaScript harness, not Safari WebKit, real Apple Pencil hardware, VoiceOver or actual offline Service Worker lifecycle. **Physical iPad acceptance is still pending.**
- No deployment, merge, production Supabase changes, permissions migration, or clearing cached study packs is included.

## Next phase

After iPad acceptance and merge, revisit the old draft offline PR #5 against updated `main` for Phase 6–7; inspect storage migration, original PWA origin, authentication, recovery/export and true airplane-mode startup before implementation.
