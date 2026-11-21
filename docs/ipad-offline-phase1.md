# iPad offline support — Phase 1 (review branch)

## Included
- Settings → Download study offline caches a verified user's Library, topics, problems, attempts and batches in IndexedDB plus the app shell, pinned CDN scripts and PDF font.
- Offline launch requires a previously verified account, a downloaded pack, and a matching local Supabase account ID.
- Hub Ghost Test results are stored locally with unique UUIDs. Sync pending results replays Hub attempts by UUID to avoid duplicates.
- A Japanese Ghost Test sheet can be downloaded while online and reopened offline. Japanese results are retained locally but are NOT synced automatically in Phase 1: the existing updater changes aggregate counters and history without idempotency protection.
- Library edits and PDF exports require an internet connection. The download operation does not delete drafts or website data.

## iPad acceptance test
1. In Safari, sign in online and open Settings → Download study offline. Verify the problem count and App files ready.
2. Open a Japanese set and select Download this Japanese sheet offline.
3. Safari Share → Add to Home Screen. Open the installed app ONLINE and repeat the download from inside that app if its storage is separate.
4. Enable airplane mode (including Wi-Fi off), close the app, reopen it and verify Home, Library, Review and saved Japanese Ghost Test.
5. Write using Apple Pencil, mark and Save results, then reopen offline and verify pending work remains.
6. Reconnect Wi-Fi, sign in and press Sync pending results; inspect Hub attempts in Supabase to ensure no duplicates.
7. Check landscape/portrait rotation, second-device behavior, and service-worker updates without clearing storage.

## Important limitations
- No unattended Japanese Supabase sync yet. Do not delete app storage until its local-only Japanese sessions have been safely exported or migrated.
- iPadOS can evict local website storage; critical unsynced work should have an export/backup path before relying on it for long periods.
- If the network is down but navigator.onLine still reports true, the fallback may not run automatically.
- The installed Home Screen app and Safari tab can have separate site storage; download from the app you will actually use.
- No physical iPad tests have been run yet. Code syntax checks alone do not prove offline operation.

## Next phase
Add a server-side idempotent Japanese review-sync ledger, backup/export of pending sessions, user-selected JLPT/topic packs, interrupted-download resume, and offline diagnostics. No production SQL schema change is part of Phase 1.