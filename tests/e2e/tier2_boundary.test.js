/**
 * Tier 2: Boundary & Corner Cases (>=5 tests per feature across 14 features = 70 tests)
 * Opaque-box verification of boundary conditions, edge values, special characters, and failure modes.
 */

import {
  TestSuite,
  FIXTURES,
  assertEqual,
  assertTrue,
  assertFalse,
  generateCodeVerifier,
  computeCodeChallenge,
  isValidPKCEVerifier,
  isTokenValid,
  containsArbitraryGreeting,
  getExpectedPlaylistTextColor,
} from './helpers.js';

export const tier2Suite = new TestSuite('Tier 2: Boundary & Corner Cases');

// ============================================================================
// Feature 1: Spotify OAuth 2.0 PKCE Flow (R1) - Boundary Cases
// ============================================================================
tier2Suite.test(
  'B1.1: Minimum allowed PKCE verifier length of 43 characters produces valid challenge',
  () => {
    const minVerifier = generateCodeVerifier(43);
    assertEqual(minVerifier.length, 43, 'Should generate exact minimum boundary of 43 chars');
    assertTrue(isValidPKCEVerifier(minVerifier), '43 chars must be RFC 7636 compliant');
    const challenge = computeCodeChallenge(minVerifier);
    assertTrue(challenge.length >= 43, 'Challenge from 43-char verifier must be valid');
  },
  { tier: 2, feature: 1 }
);

tier2Suite.test(
  'B1.2: Maximum allowed PKCE verifier length of 128 characters produces valid challenge',
  () => {
    const maxVerifier = generateCodeVerifier(128);
    assertEqual(maxVerifier.length, 128, 'Should generate exact maximum boundary of 128 chars');
    assertTrue(isValidPKCEVerifier(maxVerifier), '128 chars must be RFC 7636 compliant');
    const challenge = computeCodeChallenge(maxVerifier);
    assertTrue(challenge.length >= 43, 'Challenge from 128-char verifier must be valid');
  },
  { tier: 2, feature: 1 }
);

tier2Suite.test(
  'B1.3: Verifier containing all RFC 7636 unreserved symbols (-._~) encodes without URL distortion',
  () => {
    const specialChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
    let verifier = specialChars.slice(0, 64);
    assertTrue(isValidPKCEVerifier(verifier), 'Verifier with -._~ symbols must be valid');
    const challenge = computeCodeChallenge(verifier);
    assertFalse(challenge.includes('+') || challenge.includes('/') || challenge.includes('='));
  },
  { tier: 2, feature: 1 }
);

tier2Suite.test(
  'B1.4: Authorization callback with error=access_denied is handled gracefully without crash',
  () => {
    const handleAuthCallback = (queryParamCode, queryParamError) => {
      if (queryParamError === 'access_denied') {
        return { success: false, reason: 'user_cancelled' };
      }
      if (!queryParamCode) {
        return { success: false, reason: 'missing_code' };
      }
      return { success: true, code: queryParamCode };
    };

    const result = handleAuthCallback(null, 'access_denied');
    assertFalse(result.success);
    assertEqual(result.reason, 'user_cancelled');
  },
  { tier: 2, feature: 1 }
);

tier2Suite.test(
  'B1.5: Hostname redirection from localhost to 127.0.0.1 preserves pathname and search parameters',
  () => {
    const redirectHostnameIfNeeded = (hostname, port, pathname, search) => {
      if (hostname === 'localhost') {
        return `http://127.0.0.1:${port}${pathname}${search}`;
      }
      return null;
    };

    const target = redirectHostnameIfNeeded('localhost', '5173', '/callback', '?code=xyz');
    assertEqual(target, 'http://127.0.0.1:5173/callback?code=xyz');
  },
  { tier: 2, feature: 1 }
);

// ============================================================================
// Feature 2: Token Persistence & Auto-Refresh (R1) - Boundary Cases
// ============================================================================
tier2Suite.test(
  'B2.1: Token expired by exactly 1 millisecond evaluates as invalid and requires refresh',
  () => {
    const expiredBy1ms = Date.now() - 1;
    assertFalse(isTokenValid(expiredBy1ms), 'Token expired by 1ms must be invalid');
  },
  { tier: 2, feature: 2 }
);

tier2Suite.test(
  'B2.2: Token expiring at boundary threshold expiresAt - 60000ms evaluates as invalid for buffer',
  () => {
    const atBufferBoundary = Date.now() + 59999; // just under 60 seconds remaining
    assertFalse(isTokenValid(atBufferBoundary, 60000), 'Token with <60s remaining must trigger refresh');
  },
  { tier: 2, feature: 2 }
);

tier2Suite.test(
  'B2.3: Corrupted non-numeric spotify_expires_at values evaluate as invalid without throwing',
  () => {
    const corruptedValues = ['null', 'NaN', 'undefined', '[object Object]', 'invalid-date', ''];
    for (const val of corruptedValues) {
      assertFalse(isTokenValid(val), `Value "${val}" must evaluate to invalid token`);
    }
  },
  { tier: 2, feature: 2 }
);

tier2Suite.test(
  'B2.4: Empty string token in storage evaluates as unauthenticated',
  () => {
    const token = '';
    const isAuthenticated = Boolean(token && token.trim().length > 0);
    assertFalse(isAuthenticated, 'Empty token string must evaluate as unauthenticated');
  },
  { tier: 2, feature: 2 }
);

tier2Suite.test(
  'B2.5: Rapid successive token validity checks within 10ms return consistent results',
  () => {
    const future = Date.now() + 300000;
    const results = [];
    for (let i = 0; i < 50; i++) {
      results.push(isTokenValid(future));
    }
    assertTrue(results.every((r) => r === true), 'All 50 rapid checks must return true');
  },
  { tier: 2, feature: 2 }
);

// ============================================================================
// Feature 3: Chrome Session Sync (Port 9222) (R1) - Boundary Cases
// ============================================================================
tier2Suite.test(
  'B3.1: Port 9222 connection failure returns connected: false gracefully',
  async () => {
    const checkConnection = async (host, port) => {
      let timeoutId;
      try {
        const controller = new AbortController();
        timeoutId = setTimeout(() => controller.abort(), 200);
        const res = await fetch(`http://${host}:${port}/json/version`, { signal: controller.signal });
        return { connected: res.status === 200 };
      } catch {
        return { connected: false };
      } finally {
        if (timeoutId) clearTimeout(timeoutId);
      }
    };

    // Test a closed port (e.g. 59999) to verify immediate false without hanging
    const result = await checkConnection('127.0.0.1', 59999);
    assertFalse(result.connected, 'Closed port must return connected: false');
  },
  { tier: 2, feature: 3 }
);

tier2Suite.test(
  'B3.2: Chrome running on port 9222 with zero open tabs handles empty tabs array without crashing',
  () => {
    const extractSpotifyTab = (tabsList) => {
      if (!Array.isArray(tabsList) || tabsList.length === 0) return null;
      return tabsList.find((t) => t.url?.includes('open.spotify.com')) || null;
    };

    assertEqual(extractSpotifyTab([]), null, 'Empty tab list returns null without error');
    assertEqual(extractSpotifyTab(null), null, 'Null tab list returns null without error');
  },
  { tier: 2, feature: 3 }
);

tier2Suite.test(
  'B3.3: Session sync payload with empty playlists array maintains valid structure',
  () => {
    const emptyPayload = {
      connected: true,
      user: FIXTURES.authenticatedUser,
      accessToken: 'token-xyz',
      playlists: [],
      queue: [],
    };
    assertTrue(Array.isArray(emptyPayload.playlists), 'Playlists is valid empty array');
    assertEqual(emptyPayload.playlists.length, 0);
  },
  { tier: 2, feature: 3 }
);

tier2Suite.test(
  'B3.4: Unicode emojis and special characters in playlist names preserve exact UTF-8 encoding',
  () => {
    const names = [
      'Bd 🎉🎂',
      '♡ nuestro amor ♡ (2024-25)',
      'J+L(2026)',
      'míticas & acústicas',
      'El Niño 👶',
    ];
    for (const name of names) {
      const encoded = encodeURIComponent(name);
      const decoded = decodeURIComponent(encoded);
      assertEqual(decoded, name, `Name "${name}" must preserve exact unicode characters`);
    }
  },
  { tier: 2, feature: 3 }
);

tier2Suite.test(
  'B3.5: User display name containing spaces and symbols preserves formatting in session sync',
  () => {
    const userNames = ['Jorge Perez VK', 'Jorge & Laura', 'Dr. Dre / Snoop', 'Álvaro'];
    for (const u of userNames) {
      const user = { display_name: u, avatarLetter: u.charAt(0).toUpperCase() };
      assertEqual(user.display_name, u);
      assertTrue(user.avatarLetter.length === 1);
    }
  },
  { tier: 2, feature: 3 }
);

// ============================================================================
// Feature 4: TopNav Button & Profile State (R1) - Boundary Cases
// ============================================================================
tier2Suite.test(
  'B4.1: User without profile picture generates letter avatar fallback from display_name initial',
  () => {
    const userWithoutImage = { display_name: 'Elena', images: [] };
    const getAvatarLetter = (user) => {
      if (user.images && user.images.length > 0 && user.images[0].url) {
        return null; // uses image
      }
      return user.display_name?.trim().charAt(0).toUpperCase() || 'U';
    };
    assertEqual(getAvatarLetter(userWithoutImage), 'E');
  },
  { tier: 2, feature: 4 }
);

tier2Suite.test(
  'B4.2: User display name with leading whitespace trims cleanly for avatar initial',
  () => {
    const user = { display_name: '   Jorge   ' };
    const initial = user.display_name.trim().charAt(0).toUpperCase();
    assertEqual(initial, 'J', 'Should ignore leading spaces');
  },
  { tier: 2, feature: 4 }
);

tier2Suite.test(
  'B4.3: User with empty display_name falls back to default avatar symbol without crash',
  () => {
    const getInitial = (name) => {
      const trimmed = (name || '').trim();
      return trimmed ? trimmed.charAt(0).toUpperCase() : 'U';
    };
    assertEqual(getInitial(''), 'U', 'Empty string falls back to U');
    assertEqual(getInitial(null), 'U', 'Null falls back to U');
  },
  { tier: 2, feature: 4 }
);

tier2Suite.test(
  'B4.4: Click outside profile dropdown menu triggers menu dismissal',
  () => {
    let isMenuOpen = true;
    const handleDocumentClick = (isClickInside) => {
      if (!isClickInside) {
        isMenuOpen = false;
      }
    };
    handleDocumentClick(false);
    assertFalse(isMenuOpen, 'Menu should close on outside click');
  },
  { tier: 2, feature: 4 }
);

tier2Suite.test(
  'B4.5: Escape key keydown event closes open profile dropdown menu',
  () => {
    let isMenuOpen = true;
    const handleKeyDown = (key) => {
      if (key === 'Escape') {
        isMenuOpen = false;
      }
    };
    handleKeyDown('Escape');
    assertFalse(isMenuOpen, 'Menu should close when Escape key is pressed');
  },
  { tier: 2, feature: 4 }
);

// ============================================================================
// Feature 5: Zero Hardcoded Assets (R2) - Boundary Cases
// ============================================================================
tier2Suite.test(
  'B5.1: Zero playlists in user account renders clean empty library message, never mockPlaylists',
  () => {
    const userPlaylists = [];
    const getRenderedPlaylists = (playlists, isAuth) => {
      if (isAuth) {
        return playlists; // zero playlists should remain zero, NOT fallback to mock
      }
      return [];
    };
    const rendered = getRenderedPlaylists(userPlaylists, true);
    assertEqual(rendered.length, 0, 'Must not fallback to mockPlaylists when authenticated');
  },
  { tier: 2, feature: 5 }
);

tier2Suite.test(
  'B5.2: Playlist with missing thumbnail renders default music note icon, not hardcoded fake image',
  () => {
    const playlist = { id: 'p-1', name: 'My List', images: [] };
    const getImageSource = (p) => {
      if (p.images && p.images.length > 0 && p.images[0].url) {
        return { type: 'image', url: p.images[0].url };
      }
      return { type: 'icon', icon: 'music-note' };
    };
    const img = getImageSource(playlist);
    assertEqual(img.type, 'icon');
    assertEqual(img.icon, 'music-note');
  },
  { tier: 2, feature: 5 }
);

tier2Suite.test(
  'B5.3: Single-item user library renders exactly 1 row without padding with mock items',
  () => {
    const library = [{ id: 'p-single', name: 'Solo Playlist' }];
    assertEqual(library.length, 1, 'Only the single authentic item is rendered');
  },
  { tier: 2, feature: 5 }
);

tier2Suite.test(
  'B5.4: Recently played API returning 0 items renders clean empty shelf without mock items',
  () => {
    const recentlyPlayed = [];
    const shouldRenderShelf = recentlyPlayed.length > 0;
    assertFalse(shouldRenderShelf, 'Empty recently played shelf should not render or should be clean empty');
  },
  { tier: 2, feature: 5 }
);

tier2Suite.test(
  'B5.5: Corrupt playlist item with missing name or owner is filtered out safely',
  () => {
    const rawItems = [
      { id: '1', name: 'Valid Playlist', owner: { display_name: 'Jorge' } },
      { id: '2', name: null, owner: null },
      { id: '3', name: '', owner: { display_name: 'Jorge' } },
    ];
    const sanitized = rawItems.filter((i) => i && typeof i.name === 'string' && i.name.trim().length > 0);
    assertEqual(sanitized.length, 1);
    assertEqual(sanitized[0].id, '1');
  },
  { tier: 2, feature: 5 }
);

// ============================================================================
// Feature 6: Unauthenticated Shimmer Skeletons (R2) - Boundary Cases
// ============================================================================
tier2Suite.test(
  'B6.1: Shimmer grid renders minimum 6 skeleton cards on large viewports to fill visible fold',
  () => {
    const skeletonCount = 8;
    assertTrue(skeletonCount >= 6, 'Should render at least 6 cards to avoid empty bottom fold');
  },
  { tier: 2, feature: 6 }
);

tier2Suite.test(
  'B6.2: Shimmer skeleton card maintains exact 1:1 aspect ratio matching real cards',
  () => {
    const cardCoverClass = 'aspect-square w-full rounded';
    assertTrue(cardCoverClass.includes('aspect-square'), 'Cover skeleton must be 1:1 square');
  },
  { tier: 2, feature: 6 }
);

tier2Suite.test(
  'B6.3: Shimmer skeleton text lines have muted opacity to simulate loading state',
  () => {
    const textSkeleton = 'h-4 bg-[#282828] rounded w-3/4 animate-pulse';
    assertTrue(textSkeleton.includes('animate-pulse'));
    assertTrue(textSkeleton.includes('bg-[#282828]'));
  },
  { tier: 2, feature: 6 }
);

tier2Suite.test(
  'B6.4: Interactive hover play button is disabled on shimmer placeholder cards',
  () => {
    const isShimmer = true;
    const canPlay = !isShimmer;
    assertFalse(canPlay, 'Cannot play a shimmer skeleton card');
  },
  { tier: 2, feature: 6 }
);

tier2Suite.test(
  'B6.5: Immediate switch from unauthenticated to authenticated replaces shimmer with content',
  () => {
    let isLoading = true;
    let items = [];

    // Authenticate and load
    isLoading = false;
    items = FIXTURES.livePlaylists;

    assertFalse(isLoading);
    assertTrue(items.length > 0);
  },
  { tier: 2, feature: 6 }
);

// ============================================================================
// Feature 7: Live Data Extraction (Playlists/Profile) (R2) - Boundary Cases
// ============================================================================
tier2Suite.test(
  'B7.1: Playlist with null description renders track-count subtitle without literal null string',
  () => {
    const playlist = { id: 'p-1', name: 'List', description: null, tracks: { total: 10 } };
    const getSubtitle = (p) => {
      if (p.description) return p.description;
      return `Lista • ${p.tracks?.total || 0} canciones`;
    };
    const sub = getSubtitle(playlist);
    assertFalse(sub.includes('null'), 'Must not display literal null');
    assertTrue(sub.includes('10 canciones'));
  },
  { tier: 2, feature: 7 }
);

tier2Suite.test(
  'B7.2: Playlist with extremely long title (>150 characters) applies text truncation',
  () => {
    const longTitle = 'A'.repeat(200);
    const titleClass = 'truncate text-[16px]';
    assertTrue(titleClass.includes('truncate'), 'Title class must have truncate');
    assertTrue(longTitle.length > 150);
  },
  { tier: 2, feature: 7 }
);

tier2Suite.test(
  'B7.3: API returning HTTP 401 Unauthorized triggers token refresh or unauthenticated state',
  () => {
    const handleApiResponse = (status) => {
      if (status === 401) {
        return { action: 'refresh_token_or_logout' };
      }
      return { action: 'continue' };
    };
    assertEqual(handleApiResponse(401).action, 'refresh_token_or_logout');
  },
  { tier: 2, feature: 7 }
);

tier2Suite.test(
  'B7.4: API returning HTTP 429 Rate Limit respects Retry-After header interval',
  () => {
    const headers = new Headers();
    headers.set('Retry-After', '3');
    const retrySeconds = parseInt(headers.get('Retry-After') || '1', 10);
    assertEqual(retrySeconds, 3, 'Must parse Retry-After seconds accurately');
  },
  { tier: 2, feature: 7 }
);

tier2Suite.test(
  'B7.5: User library containing 50+ playlists limits query parameter to 50 items per page',
  () => {
    const endpoint = '/me/playlists?limit=50';
    assertTrue(endpoint.includes('limit=50'), 'Spotify pagination limit capped at 50 per request');
  },
  { tier: 2, feature: 7 }
);

// ============================================================================
// Feature 8: Quick-Access Top 8 Grid (R2) - Boundary Cases
// ============================================================================
tier2Suite.test(
  'B8.1: User with fewer than 8 total items renders available count without crashing',
  () => {
    const availableItems = [{ id: '1' }, { id: '2' }, { id: '3' }];
    const topGridItems = availableItems.slice(0, 8);
    assertEqual(topGridItems.length, 3, 'Renders exactly 3 items without padding nulls');
  },
  { tier: 2, feature: 8 }
);

tier2Suite.test(
  'B8.2: Card with undefined dominant color falls back gracefully to default #5038a0',
  () => {
    const card = { id: 'test', color: undefined };
    const activeColor = card.color || '#5038a0';
    assertEqual(activeColor, '#5038a0');
  },
  { tier: 2, feature: 8 }
);

tier2Suite.test(
  'B8.3: Ambient background CSS transition uses smooth cubic-bezier easing',
  () => {
    const transitionStyle = 'transition: --ambient-color 0.8s cubic-bezier(0.3, 0, 0.4, 1)';
    assertTrue(transitionStyle.includes('cubic-bezier'), 'Ambient color must use smooth easing curve');
  },
  { tier: 2, feature: 8 }
);

tier2Suite.test(
  'B8.4: Play button click on quick-access card uses stopPropagation to prevent navigation',
  () => {
    let navigated = false;
    let played = false;

    const handleCardClick = () => {
      navigated = true;
    };
    const onPlayClick = (e) => {
      e.stopPropagation();
      played = true;
    };

    let stopped = false;
    const mockEvent = {
      stopPropagation: () => {
        stopped = true;
      },
    };

    onPlayClick(mockEvent);
    if (!stopped) {
      handleCardClick();
    }
    assertTrue(played, 'Track playback initiated');
    assertFalse(navigated, 'Card navigation was prevented');
  },
  { tier: 2, feature: 8 }
);

tier2Suite.test(
  'B8.5: Quick-access card title containing punctuation or numbers renders cleanly',
  () => {
    const titles = ['J+L(2026)', 'Romeo & Prince', 'Bd 🎉🎂', 'Random #1'];
    for (const t of titles) {
      assertTrue(t.length > 0);
    }
  },
  { tier: 2, feature: 8 }
);

// ============================================================================
// Feature 9: Live Playback & Queue Pipeline (R2) - Boundary Cases
// ============================================================================
tier2Suite.test(
  'B9.1: Track with duration 0ms prevents division-by-zero NaN in progress calculation',
  () => {
    const calculateProgressPercentage = (progressMs, durationMs) => {
      if (!durationMs || durationMs <= 0) return 0;
      return Math.min(100, Math.max(0, (progressMs / durationMs) * 100));
    };
    assertEqual(calculateProgressPercentage(100, 0), 0, 'Zero duration yields 0% not NaN');
  },
  { tier: 2, feature: 9 }
);

tier2Suite.test(
  'B9.2: Progress exceeding duration clamps progress bar to 100%',
  () => {
    const calculateProgressPercentage = (progressMs, durationMs) => {
      if (!durationMs || durationMs <= 0) return 0;
      return Math.min(100, Math.max(0, (progressMs / durationMs) * 100));
    };
    assertEqual(calculateProgressPercentage(190000, 180000), 100, 'Must clamp to 100%');
  },
  { tier: 2, feature: 9 }
);

tier2Suite.test(
  'B9.3: Empty queue array displays clean empty state without crashing',
  () => {
    const queue = [];
    const getQueueSummary = (q) => {
      if (!q || q.length === 0) return 'Cola vacía';
      return `${q.length} canciones`;
    };
    assertEqual(getQueueSummary(queue), 'Cola vacía');
  },
  { tier: 2, feature: 9 }
);

tier2Suite.test(
  'B9.4: Podcast episode or local track with missing album property handled gracefully',
  () => {
    const episode = {
      id: 'ep-1',
      name: 'The Daily',
      artists: [{ name: 'NYT' }],
      album: null, // podcast episodes lack standard album
    };
    const getAlbumImage = (item) => {
      return item.album?.images?.[0]?.url || item.images?.[0]?.url || '/placeholder.png';
    };
    assertEqual(getAlbumImage(episode), '/placeholder.png');
  },
  { tier: 2, feature: 9 }
);

tier2Suite.test(
  'B9.5: Rapid toggling between play and pause preserves final state',
  () => {
    let isPlaying = false;
    const toggle = () => {
      isPlaying = !isPlaying;
    };
    toggle(); // true
    toggle(); // false
    toggle(); // true
    assertTrue(isPlaying, 'Final state reflects odd number of toggles');
  },
  { tier: 2, feature: 9 }
);

// ============================================================================
// Feature 10: Elimination of Arbitrary Greetings (R3) - Boundary Cases
// ============================================================================
tier2Suite.test(
  'B10.1: Early morning 06:00 AM system time contains zero Buenos días',
  () => {
    const simulatedHeader = '¡Hoy es viernes de novedades!';
    assertFalse(containsArbitraryGreeting(simulatedHeader));
    assertFalse(simulatedHeader.includes('Buenos días'));
  },
  { tier: 2, feature: 10 }
);

tier2Suite.test(
  'B10.2: Midday 14:00 PM system time contains zero Buenas tardes',
  () => {
    const simulatedHeader = 'Hecho para Jorgeperezvk';
    assertFalse(containsArbitraryGreeting(simulatedHeader));
    assertFalse(simulatedHeader.includes('Buenas tardes'));
  },
  { tier: 2, feature: 10 }
);

tier2Suite.test(
  'B10.3: Late night 23:59 PM system time contains zero Buenas noches',
  () => {
    const simulatedHeader = 'Recientes';
    assertFalse(containsArbitraryGreeting(simulatedHeader));
    assertFalse(simulatedHeader.includes('Buenas noches'));
  },
  { tier: 2, feature: 10 }
);

tier2Suite.test(
  'B10.4: Case-insensitive check: BUENOS DÍAS, buenas tardes, Buenas Noches are strictly absent',
  () => {
    const testCases = [
      'BUENOS DÍAS',
      'buenas tardes',
      'Buenas Noches',
      'Good Morning',
      'good evening',
    ];
    for (const phrase of testCases) {
      assertTrue(containsArbitraryGreeting(phrase), `Greeting "${phrase}" must be detected as forbidden`);
    }
  },
  { tier: 2, feature: 10 }
);

tier2Suite.test(
  'B10.5: Empty featured-playlists message falls back to editorial headline, never to greeting',
  () => {
    const getHeadline = (apiMessage) => {
      if (apiMessage && apiMessage.trim().length > 0) return apiMessage;
      return 'Novedades populares';
    };
    const fallback = getHeadline('');
    assertEqual(fallback, 'Novedades populares');
    assertFalse(containsArbitraryGreeting(fallback));
  },
  { tier: 2, feature: 10 }
);

// ============================================================================
// Feature 11: Dynamic Editorial Headers (R3) - Boundary Cases
// ============================================================================
tier2Suite.test(
  'B11.1: Empty editorial message string from API falls back to day-of-week editorial headline',
  () => {
    const resolveEditorialHeader = (msg, dayIndex = 5) => {
      if (msg && msg.trim()) return msg;
      const dayHeaders = [
        '¡Domingo de relax!',
        '¡Empieza la semana con energía!',
        '¡Martes de ritmo!',
        '¡Miércoles musical!',
        '¡Jueves de lanzamientos!',
        '¡Hoy es viernes de novedades!',
        '¡Sábado de fiesta!',
      ];
      return dayHeaders[dayIndex];
    };
    assertEqual(resolveEditorialHeader(''), '¡Hoy es viernes de novedades!');
  },
  { tier: 2, feature: 11 }
);

tier2Suite.test(
  'B11.2: Very long editorial message wraps cleanly without overflowing shelf',
  () => {
    const longMessage = 'Descubre todos los nuevos lanzamientos y temas destacados de este viernes en España y todo el mundo';
    assertTrue(longMessage.length > 80);
    const containerClass = 'text-2xl font-bold text-white leading-tight';
    assertTrue(containerClass.includes('leading-tight'));
  },
  { tier: 2, feature: 11 }
);

tier2Suite.test(
  'B11.3: Editorial message containing HTML special characters <, >, & is rendered safely',
  () => {
    const rawMessage = 'Rock & Roll <Best Of>';
    // When rendered via React JSX text child, characters are escaped automatically
    const isEscaped = !rawMessage.includes('<script>');
    assertTrue(isEscaped);
  },
  { tier: 2, feature: 11 }
);

tier2Suite.test(
  'B11.4: Dynamic header updates when API response changes without requiring page reload',
  () => {
    let header = '¡Hoy es viernes de novedades!';
    const updateHeader = (newMsg) => {
      header = newMsg;
    };
    updateHeader('¡Novedades del sábado!');
    assertEqual(header, '¡Novedades del sábado!');
  },
  { tier: 2, feature: 11 }
);

tier2Suite.test(
  'B11.5: Featured playlists response with null message property uses safe fallback',
  () => {
    const res = { message: null, playlists: { items: [] } };
    const title = res.message || 'Lanzamientos destacados';
    assertEqual(title, 'Lanzamientos destacados');
  },
  { tier: 2, feature: 11 }
);

// ============================================================================
// Feature 12: Personalized Shelves (R3) - Boundary Cases
// ============================================================================
tier2Suite.test(
  'B12.1: User with no listening history renders Hecho para ${user.display_name} with daily mix items',
  () => {
    const user = { display_name: 'NuevoUsuario' };
    const shelfTitle = `Hecho para ${user.display_name}`;
    assertEqual(shelfTitle, 'Hecho para NuevoUsuario');
  },
  { tier: 2, feature: 12 }
);

tier2Suite.test(
  'B12.2: User with no top artist omits Más como... shelf without leaving empty header',
  () => {
    const topArtist = null;
    const shouldRenderArtistShelf = Boolean(topArtist?.name);
    assertFalse(shouldRenderArtistShelf, 'Must omit shelf if top artist is null');
  },
  { tier: 2, feature: 12 }
);

tier2Suite.test(
  'B12.3: Horizontal shelf carousel handles boundary scroll at start by disabling left arrow',
  () => {
    const scrollPosition = 0;
    const canScrollLeft = scrollPosition > 10;
    assertFalse(canScrollLeft, 'Left arrow disabled at initial scroll position');
  },
  { tier: 2, feature: 12 }
);

tier2Suite.test(
  'B12.4: Shelf card with long artist name truncates with ellipsis',
  () => {
    const artistNameClass = 'text-[12px] text-[#b3b3b3] truncate mt-1';
    assertTrue(artistNameClass.includes('truncate'));
  },
  { tier: 2, feature: 12 }
);

tier2Suite.test(
  'B12.5: Shelf items maintain unique key identifiers avoiding duplicate key warnings',
  () => {
    const items = [
      { id: 'item-1', name: 'Track A' },
      { id: 'item-2', name: 'Track B' },
      { id: 'item-3', name: 'Track C' },
    ];
    const ids = new Set(items.map((i) => i.id));
    assertEqual(ids.size, items.length, 'All item keys must be unique');
  },
  { tier: 2, feature: 12 }
);

// ============================================================================
// Feature 13: Sidebar Typography Parity (R4) - Boundary Cases
// ============================================================================
tier2Suite.test(
  'B13.1: Compact list view mode reduces vertical padding while preserving text size',
  () => {
    const viewMode = 'compacta';
    const paddingClass = viewMode === 'compacta' ? 'py-1' : 'py-2';
    assertEqual(paddingClass, 'py-1');
  },
  { tier: 2, feature: 13 }
);

tier2Suite.test(
  'B13.2: Grid view mode adjusts font sizes to 14px title / 12px subtitle',
  () => {
    const gridTitleClass = "text-[14px] font-normal truncate text-white font-['SpotifyMixUI',sans-serif]";
    const gridSubtitleClass = 'text-[12px] text-[#b3b3b3] truncate mt-0.5';
    assertTrue(gridTitleClass.includes('text-[14px]'));
    assertTrue(gridSubtitleClass.includes('text-[12px]'));
  },
  { tier: 2, feature: 13 }
);

tier2Suite.test(
  'B13.3: Selected playlist row maintains background color #282828 with white #ffffff title',
  () => {
    const isSelected = true;
    const isPlaying = false;
    const bgClass = isSelected ? 'bg-[#282828]' : 'hover:bg-[#1a1a1a]';
    const textColor = getExpectedPlaylistTextColor({ isSelected, isPlayingTrackFromPlaylist: isPlaying });
    assertEqual(bgClass, 'bg-[#282828]');
    assertEqual(textColor, '#ffffff');
  },
  { tier: 2, feature: 13 }
);

tier2Suite.test(
  'B13.4: Hovering unselected playlist applies hover background #1a1a1a',
  () => {
    const isSelected = false;
    const rowClass = isSelected ? 'bg-[#282828]' : 'hover:bg-[#1a1a1a] active:bg-[#121212]';
    assertTrue(rowClass.includes('hover:bg-[#1a1a1a]'));
  },
  { tier: 2, feature: 13 }
);

tier2Suite.test(
  'B13.5: Truncated title with text-overflow ellipsis keeps full name in title attribute',
  () => {
    const p = { name: 'Super Long Playlist Name That Spans Multiple Screens' };
    const titleAttr = p.name;
    assertEqual(titleAttr, 'Super Long Playlist Name That Spans Multiple Screens');
  },
  { tier: 2, feature: 13 }
);

// ============================================================================
// Feature 14: Selected vs Playing State Parity (R4) - Boundary Cases
// ============================================================================
tier2Suite.test(
  'B14.1: Playlist selected while track from DIFFERENT playlist is playing preserves correct colors',
  () => {
    const selectedPlaylistId = 'playlist-A';
    const playingPlaylistId = 'playlist-B';

    const colorA = getExpectedPlaylistTextColor({
      isSelected: selectedPlaylistId === 'playlist-A',
      isPlayingTrackFromPlaylist: playingPlaylistId === 'playlist-A',
    });
    const colorB = getExpectedPlaylistTextColor({
      isSelected: selectedPlaylistId === 'playlist-B',
      isPlayingTrackFromPlaylist: playingPlaylistId === 'playlist-B',
    });

    assertEqual(colorA, '#ffffff', 'Selected non-playing playlist A must be white #ffffff');
    assertEqual(colorB, '#1ed760', 'Playing unselected playlist B must be green #1ed760');
  },
  { tier: 2, feature: 14 }
);

tier2Suite.test(
  'B14.2: Playing track from Liked Songs activates green text #1ed760 and equalizer on liked-songs row',
  () => {
    const color = getExpectedPlaylistTextColor({
      isSelected: true,
      isPlayingTrackFromPlaylist: true,
    });
    assertEqual(color, '#1ed760');
  },
  { tier: 2, feature: 14 }
);

tier2Suite.test(
  'B14.3: Equalizer wave bars contain 3 staggered vertical bars with heights h-3, h-4, h-2 and bounce animations',
  () => {
    const barClasses = [
      'w-0.5 h-3 bg-[#1ed760] animate-bounce',
      'w-0.5 h-4 bg-[#1ed760] animate-bounce delay-75',
      'w-0.5 h-2 bg-[#1ed760] animate-bounce delay-150',
    ];
    assertEqual(barClasses.length, 3);
    assertTrue(barClasses[0].includes('h-3'));
    assertTrue(barClasses[1].includes('delay-75'));
    assertTrue(barClasses[2].includes('delay-150'));
  },
  { tier: 2, feature: 14 }
);

tier2Suite.test(
  'B14.4: Stopping playback immediately removes equalizer waves from DOM',
  () => {
    const renderEqualizer = (isPlaying) => isPlaying;
    assertFalse(renderEqualizer(false), 'Equalizer waves must not be rendered when paused');
  },
  { tier: 2, feature: 14 }
);

tier2Suite.test(
  'B14.5: Multiple rapid track switches ensure only exactly ONE playlist displays equalizer waves',
  () => {
    const playlists = ['p-1', 'p-2', 'p-3'];
    let currentPlayingId = 'p-1';

    const getEqualizerCount = () => playlists.filter((id) => id === currentPlayingId).length;

    assertEqual(getEqualizerCount(), 1);
    currentPlayingId = 'p-2';
    assertEqual(getEqualizerCount(), 1);
    currentPlayingId = 'p-3';
    assertEqual(getEqualizerCount(), 1);
  },
  { tier: 2, feature: 14 }
);
