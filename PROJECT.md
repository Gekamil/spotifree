# Project: Spotifree Fixes & Albums Feature (v0.2.2)

## Architecture
- **Frontend Framework**: React 19, TypeScript, Tailwind CSS, Vite.
- **State Management**: Zustand stores (`useSpotifyDataStore.ts`, `usePlayerStore.ts`, `useUIStore.ts`).
- **Data Persistence**: Multi-tier local storage (`spotifree_saved_library_playlists`, `user_imported_playlists`, `spotifree_playlist_cache_*`, `spotify_extracted_session`, `spotifree_playlist_tracks_*`).
- **Backend & Proxy API**: `server.mjs` (Express backend) and `vite.config.ts` (dev server proxy middleware), `api/search.js`, `api/playlist.js`.
- **Search Architecture**:
  - Unified search via `src/services/spotifyApi.ts` query pipeline (Spotify Web API / Deezer / iTunes / SoundCloud).
  - Search views: `DesktopSearchView.tsx` and `MobileSearchView.tsx`.
- **Playlist & Album Views**:
  - `DesktopPlaylistView.tsx` and `MobilePlaylistView.tsx` render both playlists and albums (`alb-*` prefix routed to album view).
  - Modal: `src/components/modals/AddToPlaylistModal.tsx` for adding songs to existing or new playlists.

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| F1 | Official Remixes Prioritization | In "Remixes" search tab, prioritize official catalog remixes for searched artists at the top before SoundCloud/leaks, with green official badges | M1 | ORIGINAL_REQUEST § R1 |
| F2 | Desktop & Mobile Remix View Parity | Ensure both DesktopSearchView and MobileSearchView render official remixes cleanly and support playback | M1 | ORIGINAL_REQUEST § R1 |
| F3 | Mobile Search Albums Tab & Filter | Add "Álbumes" filter pill, `filter === 'albumes'`, and `results.albums` in MobileSearchView | M2 | ORIGINAL_REQUEST § R4 |
| F4 | Mobile Search Album Cards & Overview | Render album cards with cover, title, artist, and year in MobileSearchView ('todo' shelf and dedicated 'albumes' list) | M2 | ORIGINAL_REQUEST § R4 |
| F5 | Deezer/Spotify Album Resolution (`alb-*`) | Implement `https://api.deezer.com/album/${dzId}` resolver in `api/playlist.js`, `server.mjs`, `vite.config.ts`, `spotifyApi.ts` so clicking albums loads full tracklists | M2 | ORIGINAL_REQUEST § R4 |
| F6 | Playlist View Auto-Save Prevention | Prevent non-library playlists from being auto-added to `user_imported_playlists` in `updatePlaylist` and `DesktopPlaylistView` when viewing/loading tracks | M3 | ORIGINAL_REQUEST § R3 |
| F7 | Explicit Library Save Integrity | Ensure playlists are only added to user library (`spotifree_saved_library_playlists` and `allUserPlaylists`) when user explicitly clicks "+" or save | M3 | ORIGINAL_REQUEST § R3 |
| F8 | Upgraded `createPlaylist` Initial Tracks | Support `initialTracks?: Track[]` parameter in `useSpotifyDataStore.createPlaylist` with comprehensive storage tier persistence | M4 | ORIGINAL_REQUEST § R2 |
| F9 | AddToPlaylistModal Track & Playlist Persistence | Fix race conditions in `AddToPlaylistModal.tsx`, immediately create & persist playlist with track, auto-close modal with confirmation toast | M4 | ORIGINAL_REQUEST § R2 |
| F10 | Version Bump to 0.2.2 | Update version in `package.json` to 0.2.2 and update `src/data/changelog.ts` with release 0.2.2 notes | M5 | ORIGINAL_REQUEST § R5 |
| F11 | Regression & Full Verification Baseline | Ensure `npm test` (all 12+ suites) and `npm run build` pass with 0 errors, preserving R5 offline files | M5 | ORIGINAL_REQUEST § R5 |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M0 | E2E Testing Track | Design 4-tier opaque-box test suite (`TEST_INFRA.md`, `TEST_READY.md`) | none | DONE (61 tests in tests/e2e_spotifree_r1_r5.test.mjs) |
| M1 | Official Remixes Prioritization | F1, F2: Prioritize official remixes in search API & Desktop/Mobile views | none | DONE (gate passed, verified with tests) |
| M2 | Albums Filter & Resolution | F3, F4, F5: Albums tab in MobileSearchView, Deezer album resolution `alb-*` | M1 | IN_PROGRESS (suborch_m2) |
| M3 | Prevent Auto-Save on Playlist Viewing | F6, F7: Fix `updatePlaylist` auto-save defect in store and DesktopPlaylistView | none | IN_PROGRESS (suborch_m3: 63103362-76ec-4580-967d-b6205b44f11c) |
| M4 | Playlist Creation from Add Modal | F8, F9: Upgraded `createPlaylist` with tracks, fix AddToPlaylistModal race condition | M3 | PLANNED |
| M5 | Version Bump & E2E Acceptance Pass | F10, F11: 0.2.2 versioning, changelog, and 100% E2E test suite pass | M0, M1, M2, M3, M4 | PLANNED |

## Interface Contracts
### Search Engine ↔ Search Views
- Input query: `string` (e.g., "quevedo", "bad bunny", "bizarrap")
- Output structure from `searchSpotify(q)`:
  ```ts
  {
    tracks: { items: Track[] },
    soundcloudTracks: { items: (Track & { isOfficial?: boolean; scVariantLabel?: string; scBadgeColor?: string })[] },
    artists: { items: Artist[] },
    albums: { items: Album[] },
    playlists: { items: Playlist[] }
  }
  ```
- Official remixes ordering contract:
  - Any track with `isOfficial === true` or verified official catalog origin matching `/\b(remix|rmx)\b/i` MUST appear before non-official SoundCloud tracks in `soundcloudTracks.items`.

### Album Resolution Contract
- Album ID format: `alb-${dzId}` (e.g., `alb-316164367` for "Un Verano Sin Ti")
- Resolver endpoint: `/api/spotify/playlist/alb-${dzId}` and direct service `resolveSpotifyPlaylist('alb-${dzId}')`
- Response: Standard `Playlist` object where:
  - `type === 'album'`
  - `name`: Album title
  - `owner`: Primary artist object
  - `images`: Album cover images
  - `tracks`: Object with `total: number` and `items: Track[]` containing all songs from the album with titles, artists, duration, and streamable metadata.

### Store ↔ Library Contract
- Viewing a playlist (via navigation, search, or recommendation):
  - MUST NOT write to `localStorage['user_imported_playlists']` or `localStorage['spotifree_saved_library_playlists']`.
  - MUST NOT add the playlist to `s.playlists` (`allUserPlaylists`).
  - Cache operations MUST ONLY update `s.playlistDetailsCache` and `localStorage['spotifree_playlist_cache_*']`.
- Explicit follow/save action:
  - User clicking "+" or "Añadir a Tu biblioteca" calls `addCustomPlaylist` and pushes ID to `spotifree_saved_library_playlists`.
- Playlist creation from modal:
  - `createPlaylist(name, [initialTrack])`: Returns `Playlist` with `tracks.total === 1`, stores in `user_imported_playlists`, `spotifree_saved_library_playlists`, `spotifree_playlist_cache_*`, and persists `spotifree_playlist_tracks_${cleanId}`.

## Code Layout
- `src/services/spotifyApi.ts`: Client-side search and album/playlist resolution services. Owned by M1 & M2.
- `api/search.js`: Serverless search API handler. Owned by M1.
- `server.mjs`: Node Express backend. Owned by M1 & M2. (R5 preservation: audio/offline routes intact).
- `vite.config.ts`: Vite dev server proxy middleware. Owned by M1 & M2.
- `api/playlist.js`: Playlist and album details resolution handler. Owned by M2.
- `src/components/desktop/DesktopSearchView.tsx`: Desktop search view. Owned by M1.
- `src/components/mobile/MobileSearchView.tsx`: Mobile search view. Owned by M1 & M2.
- `src/store/useSpotifyDataStore.ts`: Global music data store. Owned by M3 & M4 (sequenced).
- `src/components/desktop/DesktopPlaylistView.tsx`: Desktop playlist view. Owned by M3.
- `src/components/mobile/MobilePlaylistView.tsx`: Mobile playlist view. Owned by M3.
- `src/components/modals/AddToPlaylistModal.tsx`: Add-to-playlist modal. Owned by M4.
- `package.json` & `src/data/changelog.ts`: Versioning and release notes. Owned by M5.
- `tests/`: Automated test suites. Owned by M0 (E2E Track) and M5.
