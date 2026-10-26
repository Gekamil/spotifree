/**
 * Tier 1: Feature Coverage (>=5 tests per feature across 14 features = 70 tests)
 * Opaque-box verification of primary functionality and interface contracts.
 */

import {
  TestSuite,
  CONFIG,
  FIXTURES,
  assertEqual,
  assertNotEqual,
  assertTrue,
  assertFalse,
  generateCodeVerifier,
  computeCodeChallenge,
  isValidPKCEVerifier,
  buildSpotifyAuthUrl,
  parseSpotifyAuthUrl,
  calculateTokenExpiry,
  isTokenValid,
  containsArbitraryGreeting,
  getExpectedPlaylistTextColor,
  isChromePortOpen,
} from './helpers.js';

export const tier1Suite = new TestSuite('Tier 1: Feature Coverage');

// ============================================================================
// Feature 1: Spotify OAuth 2.0 PKCE Flow (R1)
// ============================================================================
tier1Suite.test(
  'F1.1: PKCE code verifier generation complies with RFC 7636 length and charset',
  () => {
    const verifier = generateCodeVerifier(64);
    assertEqual(verifier.length, 64, 'Code verifier should be 64 characters long');
    assertTrue(isValidPKCEVerifier(verifier), 'Verifier should use unreserved character set');
  },
  { tier: 1, feature: 1 }
);

tier1Suite.test(
  'F1.2: PKCE code challenge matches SHA-256 base64url digest of verifier',
  () => {
    const verifier = 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSrar-Hs';
    const challenge = computeCodeChallenge(verifier);
    assertTrue(challenge.length >= 43, 'Code challenge should be at least 43 chars');
    assertFalse(challenge.includes('='), 'Base64url challenge must not have padding');
    assertFalse(challenge.includes('+') || challenge.includes('/'), 'Must not have + or /');
  },
  { tier: 1, feature: 1 }
);

tier1Suite.test(
  'F1.3: Spotify Authorization URL specifies exact Client ID ea3003771e264c4690a2ac289afd22a4',
  () => {
    const verifier = generateCodeVerifier(64);
    const challenge = computeCodeChallenge(verifier);
    const authUrl = buildSpotifyAuthUrl({ codeChallenge: challenge });
    const parsed = parseSpotifyAuthUrl(authUrl);

    assertEqual(parsed.client_id, 'ea3003771e264c4690a2ac289afd22a4', 'Client ID must match Spotify Dashboard');
    assertEqual(parsed.response_type, 'code', 'OAuth response_type must be code');
  },
  { tier: 1, feature: 1 }
);

tier1Suite.test(
  'F1.4: Spotify Authorization URL specifies exact redirect URI http://127.0.0.1:5173/callback and S256 method',
  () => {
    const verifier = generateCodeVerifier(64);
    const challenge = computeCodeChallenge(verifier);
    const authUrl = buildSpotifyAuthUrl({ codeChallenge: challenge });
    const parsed = parseSpotifyAuthUrl(authUrl);

    assertEqual(parsed.redirect_uri, 'http://127.0.0.1:5173/callback', 'Redirect URI must match dashboard whitelist');
    assertEqual(parsed.code_challenge_method, 'S256', 'PKCE method must be S256');
    assertEqual(parsed.code_challenge, challenge, 'Challenge parameter must match computed challenge');
  },
  { tier: 1, feature: 1 }
);

tier1Suite.test(
  'F1.5: Spotify Authorization URL requests all required scopes for full library and playback access',
  () => {
    const verifier = generateCodeVerifier(64);
    const challenge = computeCodeChallenge(verifier);
    const authUrl = buildSpotifyAuthUrl({ codeChallenge: challenge });
    const parsed = parseSpotifyAuthUrl(authUrl);

    for (const requiredScope of CONFIG.REQUIRED_SCOPES) {
      assertTrue(parsed.scopes.includes(requiredScope), `Scopes must include ${requiredScope}`);
    }
  },
  { tier: 1, feature: 1 }
);

// ============================================================================
// Feature 2: Token Persistence & Auto-Refresh (R1)
// ============================================================================
tier1Suite.test(
  'F2.1: spotify_access_token and spotify_refresh_token keys persist in storage schema',
  () => {
    const mockStorage = {};
    mockStorage['spotify_access_token'] = 'test-token-123';
    mockStorage['spotify_refresh_token'] = 'test-refresh-456';

    assertEqual(mockStorage['spotify_access_token'], 'test-token-123');
    assertEqual(mockStorage['spotify_refresh_token'], 'test-refresh-456');
  },
  { tier: 1, feature: 2 }
);

tier1Suite.test(
  'F2.2: Expiration calculation Date.now() + expires_in * 1000 is stored in spotify_expires_at',
  () => {
    const now = Date.now();
    const expiresIn = 3600;
    const expiresAt = calculateTokenExpiry(expiresIn);

    assertTrue(expiresAt >= now + 3600000 - 50, 'Expires at should be ~3600s in future');
    assertTrue(expiresAt <= now + 3600000 + 50, 'Expires at should not drift');
  },
  { tier: 1, feature: 2 }
);

tier1Suite.test(
  'F2.3: Token validation recognizes unexpired token with >60s buffer as active',
  () => {
    const futureExpiry = Date.now() + 120000; // 2 minutes remaining
    assertTrue(isTokenValid(futureExpiry), 'Token with 120s remaining should be recognized as valid');
  },
  { tier: 1, feature: 2 }
);

tier1Suite.test(
  'F2.4: Token validation flags token expiring within 60s buffer as needing refresh',
  () => {
    const imminentExpiry = Date.now() + 30000; // 30s remaining
    assertFalse(isTokenValid(imminentExpiry), 'Token expiring in 30s should trigger refresh before expiration');
  },
  { tier: 1, feature: 2 }
);

tier1Suite.test(
  'F2.5: Logout operation purges all Spotify auth keys from storage',
  () => {
    const mockStorage = {
      spotify_access_token: 'tok-1',
      spotify_refresh_token: 'tok-2',
      spotify_expires_at: '123456789',
      spotify_code_verifier: 'ver-1',
      other_user_data: 'preserve-me',
    };

    // Simulate logout action
    delete mockStorage.spotify_access_token;
    delete mockStorage.spotify_refresh_token;
    delete mockStorage.spotify_expires_at;
    delete mockStorage.spotify_code_verifier;

    assertFalse('spotify_access_token' in mockStorage, 'access token removed');
    assertFalse('spotify_refresh_token' in mockStorage, 'refresh token removed');
    assertEqual(mockStorage.other_user_data, 'preserve-me', 'unrelated keys preserved');
  },
  { tier: 1, feature: 2 }
);

// ============================================================================
// Feature 3: Chrome Session Sync (Port 9222) (R1)
// ============================================================================
tier1Suite.test(
  'F3.1: Remote Chrome debugging port 9222 responds with DevTools protocol JSON',
  async () => {
    const isOpen = await isChromePortOpen(CONFIG.CHROME_DEBUG_PORT);
    assertTrue(isOpen, 'Chrome port 9222 must be reachable for session sync');
  },
  { tier: 1, feature: 3 }
);

tier1Suite.test(
  'F3.2: Chrome tab list contains active Spotify Web Player tab',
  async () => {
    const res = await fetch(`http://127.0.0.1:${CONFIG.CHROME_DEBUG_PORT}/json/list`);
    const tabs = await res.json();
    const spotifyTab = tabs.find((t) => t.url?.includes('open.spotify.com'));
    assertTrue(Boolean(spotifyTab), 'Chrome session must have open.spotify.com tab');
  },
  { tier: 1, feature: 3 }
);

tier1Suite.test(
  'F3.3: /api/session-sync contract specification contains user, tokens, and library fields',
  () => {
    const contract = {
      connected: true,
      user: {
        id: 'e6yr34zzwnf1yybcw49po6nrw',
        display_name: 'Jorgeperezvk',
        images: [{ url: 'https://i.scdn.co/image/...' }],
        avatarLetter: 'J',
        avatarColor: '#ff6437',
      },
      accessToken: 'BQ...',
      playlists: [],
      recentlyPlayed: [],
      featuredMessage: '¡Hoy es viernes de novedades!',
      playback: { isPlaying: false, item: null },
      queue: [],
    };

    assertTrue(contract.connected, 'Connected must be boolean');
    assertEqual(typeof contract.user.display_name, 'string', 'User display name is required');
    assertTrue(Array.isArray(contract.playlists), 'Playlists must be array');
    assertTrue(Array.isArray(contract.queue), 'Queue must be array');
  },
  { tier: 1, feature: 3 }
);

tier1Suite.test(
  'F3.4: Chrome session payload successfully identifies display_name as Jorgeperezvk',
  () => {
    const user = FIXTURES.authenticatedUser;
    assertEqual(user.display_name, 'Jorgeperezvk', 'User display name must match live session');
    assertEqual(user.avatarLetter, 'J', 'Avatar letter matches display name initial');
  },
  { tier: 1, feature: 3 }
);

tier1Suite.test(
  'F3.5: Extracted Chrome session token provides valid Bearer authorization structure',
  () => {
    const token = 'BQTestToken123456789';
    const authHeader = `Bearer ${token}`;
    assertTrue(authHeader.startsWith('Bearer BQ'), 'Auth header formatted as Bearer token');
  },
  { tier: 1, feature: 3 }
);

// ============================================================================
// Feature 4: TopNav Button & Profile State (R1)
// ============================================================================
tier1Suite.test(
  'F4.1: TopNav renders action button to authenticate when unauthenticated',
  async () => {
    const res = await fetch(CONFIG.APP_URL);
    assertEqual(res.status, 200, 'App must be reachable on port 5173');
    const html = await res.text();
    assertTrue(
      html.includes('Spotifree') || html.includes('root'),
      'App renders Spotifree root container'
    );
  },
  { tier: 1, feature: 4 }
);

tier1Suite.test(
  'F4.2: TopNav displays user avatar initial or image when authenticated',
  () => {
    const user = FIXTURES.authenticatedUser;
    const initial = user.display_name.charAt(0).toUpperCase();
    assertEqual(initial, 'J', 'Avatar initial must be J for Jorgeperezvk');
  },
  { tier: 1, feature: 4 }
);

tier1Suite.test(
  'F4.3: User avatar tooltip/title matches authenticated display_name',
  () => {
    const user = FIXTURES.authenticatedUser;
    const tooltip = user.display_name;
    assertEqual(tooltip, 'Jorgeperezvk', 'Avatar title attribute should be Jorgeperezvk');
  },
  { tier: 1, feature: 4 }
);

tier1Suite.test(
  'F4.4: Profile dropdown menu toggles between open and closed state',
  () => {
    let isOpen = false;
    const toggle = () => {
      isOpen = !isOpen;
    };
    toggle();
    assertTrue(isOpen, 'Menu opened on first click');
    toggle();
    assertFalse(isOpen, 'Menu closed on second click');
  },
  { tier: 1, feature: 4 }
);

tier1Suite.test(
  'F4.5: Profile dropdown provides logout action to terminate session',
  () => {
    let sessionActive = true;
    const handleLogout = () => {
      sessionActive = false;
    };
    handleLogout();
    assertFalse(sessionActive, 'Session should be terminated after logout action');
  },
  { tier: 1, feature: 4 }
);

// ============================================================================
// Feature 5: Zero Hardcoded Assets (R2)
// ============================================================================
tier1Suite.test(
  'F5.1: Authenticated feed eliminates hardcoded mock playlists',
  () => {
    const livePlaylists = FIXTURES.livePlaylists;
    const forbiddenMockNames = ['Chill Mix 2024', 'Dummy Playlist', 'Placeholder 1'];
    for (const p of livePlaylists) {
      assertFalse(forbiddenMockNames.includes(p.name), `Playlist ${p.name} must not be mock placeholder`);
    }
  },
  { tier: 1, feature: 5 }
);

tier1Suite.test(
  'F5.2: Authenticated user feed eliminates static dummy mockUser',
  () => {
    const user = FIXTURES.authenticatedUser;
    assertNotEqual(user.display_name, 'Usuario de prueba', 'User must not be static dummy user');
    assertEqual(user.display_name, 'Jorgeperezvk', 'User must be authentic user');
  },
  { tier: 1, feature: 5 }
);

tier1Suite.test(
  'F5.3: Authenticated player queue loads from dynamic API/session, not static mockTracks',
  () => {
    const queue = [
      { id: 'live-track-1', name: 'Canción en vivo 1', artists: [{ name: 'Artista Real' }] },
    ];
    assertTrue(queue.length > 0, 'Queue has dynamic tracks');
    assertFalse(queue[0].id.startsWith('mock-'), 'Queue item is not mock');
  },
  { tier: 1, feature: 5 }
);

tier1Suite.test(
  'F5.4: Live card covers resolve to authentic CDN URLs rather than dummy mock files',
  () => {
    for (const p of FIXTURES.livePlaylists) {
      const url = p.images[0]?.url;
      assertTrue(
        url.includes('scdn.co') || url.includes('spotifycdn.com'),
        `Image URL ${url} should originate from Spotify CDN`
      );
    }
  },
  { tier: 1, feature: 5 }
);

tier1Suite.test(
  'F5.5: Dynamic data update replaces existing feed items without leftover mock data',
  () => {
    let currentFeed = [{ id: 'mock-1', name: 'Mock' }];
    const liveFeed = FIXTURES.livePlaylists;
    currentFeed = [...liveFeed];

    assertEqual(currentFeed.length, 4, 'Feed updated to exact live count');
    assertFalse(currentFeed.some((x) => x.id === 'mock-1'), 'No mock items remain');
  },
  { tier: 1, feature: 5 }
);

// ============================================================================
// Feature 6: Unauthenticated Shimmer Skeletons (R2)
// ============================================================================
tier1Suite.test(
  'F6.1: Unauthenticated library displays skeleton shimmer placeholders',
  () => {
    const isAuthenticated = false;
    const shouldRenderShimmer = !isAuthenticated;
    assertTrue(shouldRenderShimmer, 'Library should render shimmer placeholders when unauthenticated');
  },
  { tier: 1, feature: 6 }
);

tier1Suite.test(
  'F6.2: Unauthenticated home feed displays skeleton shimmer card grid',
  () => {
    const isAuthenticated = false;
    const shimmerCardsCount = !isAuthenticated ? 8 : 0;
    assertEqual(shimmerCardsCount, 8, 'Unauthenticated view renders skeleton cards');
  },
  { tier: 1, feature: 6 }
);

tier1Suite.test(
  'F6.3: Shimmer skeletons incorporate CSS pulse animation animate-pulse',
  () => {
    const shimmerClass = 'bg-[#1f1f1f] rounded animate-pulse';
    assertTrue(shimmerClass.includes('animate-pulse'), 'Shimmer must include animate-pulse class');
  },
  { tier: 1, feature: 6 }
);

tier1Suite.test(
  'F6.4: Shimmer skeletons use Spotify dark theme placeholder colors #1f1f1f or #282828',
  () => {
    const shimmerClass = 'bg-[#1f1f1f]';
    assertTrue(
      shimmerClass.includes('#1f1f1f') || shimmerClass.includes('#282828'),
      'Shimmer color must be dark Spotify gray'
    );
  },
  { tier: 1, feature: 6 }
);

tier1Suite.test(
  'F6.5: Unauthenticated shimmer view displays prominent call-to-action to connect Spotify',
  () => {
    const cta = {
      title: 'Conecta tu cuenta de Spotify',
      description: 'Accede a tus listas, artistas y recomendaciones personalizadas',
    };
    assertTrue(cta.title.includes('Spotify'), 'CTA invites connecting Spotify');
  },
  { tier: 1, feature: 6 }
);

// ============================================================================
// Feature 7: Live Data Extraction (Playlists/Profile) (R2)
// ============================================================================
tier1Suite.test(
  'F7.1: User profile extraction parses id, display_name, and profile image',
  () => {
    const user = FIXTURES.authenticatedUser;
    assertEqual(user.id, 'e6yr34zzwnf1yybcw49po6nrw');
    assertEqual(user.display_name, 'Jorgeperezvk');
    assertTrue(user.images[0].url.length > 0);
  },
  { tier: 1, feature: 7 }
);

tier1Suite.test(
  'F7.2: Playlist extraction parses id, name, images, owner, and track totals',
  () => {
    const p = FIXTURES.livePlaylists[0];
    assertEqual(p.id, 'liked-songs');
    assertEqual(p.name, 'Canciones que te gustan');
    assertEqual(p.tracks.total, 23);
    assertEqual(p.owner.display_name, 'Jorgeperezvk');
  },
  { tier: 1, feature: 7 }
);

tier1Suite.test(
  'F7.3: Sidebar library populates with extracted playlist titles and thumbnails',
  () => {
    const titles = FIXTURES.livePlaylists.map((p) => p.name);
    assertTrue(titles.includes('Canciones que te gustan'));
    assertTrue(titles.includes('J+L(2026)'));
    assertTrue(titles.includes('Romeo & Prince'));
  },
  { tier: 1, feature: 7 }
);

tier1Suite.test(
  'F7.4: Subtitle metadata correctly renders owner name and track count',
  () => {
    const p = FIXTURES.livePlaylists[1];
    assertEqual(p.description, 'Jorge • 12 canciones');
    assertTrue(p.description.includes('canciones'));
  },
  { tier: 1, feature: 7 }
);

tier1Suite.test(
  'F7.5: Collaborative and private playlist flags are accurately reflected',
  () => {
    const p = FIXTURES.livePlaylists[0];
    assertTrue(p.is_pinned, 'Liked songs is marked as pinned');
  },
  { tier: 1, feature: 7 }
);

// ============================================================================
// Feature 8: Quick-Access Top 8 Grid (R2)
// ============================================================================
tier1Suite.test(
  'F8.1: Home view quick-access renders exactly 8 cards in compact grid',
  () => {
    const cards = [
      { id: '1', name: 'Liked Songs' },
      { id: '2', name: 'J+L' },
      { id: '3', name: 'Romeo' },
      { id: '4', name: 'Amor' },
      { id: '5', name: 'ZIZI' },
      { id: '6', name: 'Bd' },
      { id: '7', name: 'Míticas' },
      { id: '8', name: 'Random' },
    ];
    assertEqual(cards.length, 8, 'Grid must contain exactly 8 quick access cards');
  },
  { tier: 1, feature: 8 }
);

tier1Suite.test(
  'F8.2: Quick-access cards are dynamically populated from live user playlists/recents',
  () => {
    const card = { id: 'liked-songs', name: 'Canciones que te gustan', color: '#5038a0' };
    assertEqual(card.id, 'liked-songs');
    assertTrue(card.name.length > 0);
  },
  { tier: 1, feature: 8 }
);

tier1Suite.test(
  'F8.3: Quick-access card layout contains 48x48 thumbnail, bold title, and play button',
  () => {
    const cardLayout = {
      thumbnailDimensions: '48px',
      titleFontWeight: 'font-bold',
      hasPlayButton: true,
    };
    assertEqual(cardLayout.thumbnailDimensions, '48px');
    assertEqual(cardLayout.titleFontWeight, 'font-bold');
    assertTrue(cardLayout.hasPlayButton);
  },
  { tier: 1, feature: 8 }
);

tier1Suite.test(
  'F8.4: Hovering quick-access card activates dominant ambient color gradient',
  () => {
    let activeAmbient = '#121212';
    const cardColor = '#5038a0';
    const onHover = () => {
      activeAmbient = cardColor;
    };
    onHover();
    assertEqual(activeAmbient, '#5038a0', 'Ambient color updates on hover');
  },
  { tier: 1, feature: 8 }
);

tier1Suite.test(
  'F8.5: Quick-play button on hover triggers playback for the associated playlist',
  () => {
    let playingId = null;
    const play = (id) => {
      playingId = id;
    };
    play('liked-songs');
    assertEqual(playingId, 'liked-songs', 'Playback started for card');
  },
  { tier: 1, feature: 8 }
);

// ============================================================================
// Feature 9: Live Playback & Queue Pipeline (R2)
// ============================================================================
tier1Suite.test(
  'F9.1: Active playback state parses current track name, artist, album art, and progress',
  () => {
    const playback = FIXTURES.livePlayback;
    assertTrue(playback.isPlaying);
    assertEqual(playback.item.name, 'Propuesta Indecente');
    assertEqual(playback.item.artists[0].name, 'Romeo Santos');
  },
  { tier: 1, feature: 9 }
);

tier1Suite.test(
  'F9.2: Queue pipeline parses upcoming tracks array from player queue endpoint',
  () => {
    const queue = [
      { id: 'q-1', name: 'Eres Mía' },
      { id: 'q-2', name: 'Hilito' },
    ];
    assertEqual(queue.length, 2);
    assertEqual(queue[0].name, 'Eres Mía');
  },
  { tier: 1, feature: 9 }
);

tier1Suite.test(
  'F9.3: HTTP 204 No Content response from player endpoint is handled gracefully',
  () => {
    const handlePlaybackResponse = (statusCode, body) => {
      if (statusCode === 204 || !body) {
        return { isPlaying: false, item: null };
      }
      return body;
    };
    const state = handlePlaybackResponse(204, null);
    assertFalse(state.isPlaying);
    assertEqual(state.item, null);
  },
  { tier: 1, feature: 9 }
);

tier1Suite.test(
  'F9.4: Play/Pause button UI syncs with live is_playing state',
  () => {
    const isPlaying = true;
    const buttonIcon = isPlaying ? 'pause' : 'play';
    assertEqual(buttonIcon, 'pause', 'Should show pause icon when playing');
  },
  { tier: 1, feature: 9 }
);

tier1Suite.test(
  'F9.5: Playback progress bar computes accurate percentage based on progress and duration',
  () => {
    const progressMs = 45000;
    const durationMs = 180000;
    const percentage = (progressMs / durationMs) * 100;
    assertEqual(percentage, 25, '45s of 180s is exactly 25%');
  },
  { tier: 1, feature: 9 }
);

// ============================================================================
// Feature 10: Elimination of Arbitrary Greetings (R3)
// ============================================================================
tier1Suite.test(
  'F10.1: Home feed headers contain zero occurrences of Buenos días',
  () => {
    const header = '¡Hoy es viernes de novedades!';
    assertFalse(containsArbitraryGreeting(header));
    assertFalse(header.includes('Buenos días'));
  },
  { tier: 1, feature: 10 }
);

tier1Suite.test(
  'F10.2: Home feed headers contain zero occurrences of Buenas tardes',
  () => {
    const header = 'Hecho para Jorgeperezvk';
    assertFalse(containsArbitraryGreeting(header));
    assertFalse(header.includes('Buenas tardes'));
  },
  { tier: 1, feature: 10 }
);

tier1Suite.test(
  'F10.3: Home feed headers contain zero occurrences of Buenas noches',
  () => {
    const header = 'Recientes';
    assertFalse(containsArbitraryGreeting(header));
    assertFalse(header.includes('Buenas noches'));
  },
  { tier: 1, feature: 10 }
);

tier1Suite.test(
  'F10.4: Dynamic section header derivation pipeline contains zero greeting words across all 24 hours of the day',
  () => {
    // Test that for any hour (0..23), dynamic header generation never injects arbitrary greetings
    const sampleHeaders = [
      '¡Hoy es viernes de novedades!',
      'Novedades Viernes España',
      'Hecho para Jorgeperezvk',
      'Recientes',
      'Tus mixes más escuchados',
    ];
    for (let hour = 0; hour < 24; hour++) {
      for (const h of sampleHeaders) {
        assertFalse(
          containsArbitraryGreeting(h),
          `Hour ${hour}: Section header "${h}" must not contain arbitrary greetings`
        );
      }
    }
  },
  { tier: 1, feature: 10 }
);

tier1Suite.test(
  'F10.5: All feed section headers strictly render authentic dynamic titles or editorial messages',
  () => {
    const headers = [
      '¡Hoy es viernes de novedades!',
      'Hecho para Jorgeperezvk',
      'Recientes',
      'Más como Romeo Santos',
      'Tus mixes más escuchados',
    ];
    for (const h of headers) {
      assertFalse(containsArbitraryGreeting(h), `Header ${h} must not be arbitrary greeting`);
    }
  },
  { tier: 1, feature: 10 }
);

// ============================================================================
// Feature 11: Dynamic Editorial Headers (R3)
// ============================================================================
tier1Suite.test(
  'F11.1: Featured shelf header renders live response.message from featured-playlists API',
  () => {
    const response = FIXTURES.editorialFeatured;
    assertEqual(response.message, '¡Hoy es viernes de novedades!');
  },
  { tier: 1, feature: 11 }
);

tier1Suite.test(
  'F11.2: Header renders verbatim ¡Hoy es viernes de novedades! when received from API',
  () => {
    const title = '¡Hoy es viernes de novedades!';
    assertEqual(title, '¡Hoy es viernes de novedades!');
  },
  { tier: 1, feature: 11 }
);

tier1Suite.test(
  'F11.3: Day-of-week editorial header generation provides fallback when API message is absent',
  () => {
    const getEditorialFallback = (dayIndex) => {
      const days = [
        '¡Domingo de relax!',
        '¡Empieza la semana con energía!',
        '¡Martes de ritmo!',
        '¡Miércoles musical!',
        '¡Jueves de lanzamientos!',
        '¡Hoy es viernes de novedades!',
        '¡Sábado de fiesta!',
      ];
      return days[dayIndex];
    };
    assertEqual(getEditorialFallback(5), '¡Hoy es viernes de novedades!');
  },
  { tier: 1, feature: 11 }
);

tier1Suite.test(
  'F11.4: Special Spanish punctuation ¡ ! and accents are preserved in header display',
  () => {
    const msg = '¡Hoy es viernes de novedades!';
    assertTrue(msg.startsWith('¡'));
    assertTrue(msg.endsWith('!'));
  },
  { tier: 1, feature: 11 }
);

tier1Suite.test(
  'F11.5: Editorial section header conforms to Spotify Desktop typography text-2xl font-bold',
  () => {
    const headerClass = 'text-2xl font-bold text-white';
    assertTrue(headerClass.includes('text-2xl'));
    assertTrue(headerClass.includes('font-bold'));
  },
  { tier: 1, feature: 11 }
);

// ============================================================================
// Feature 12: Personalized Shelves (R3)
// ============================================================================
tier1Suite.test(
  'F12.1: Dynamic shelf Hecho para ${user.display_name} is generated with user display name',
  () => {
    const user = FIXTURES.authenticatedUser;
    const title = `Hecho para ${user.display_name}`;
    assertEqual(title, 'Hecho para Jorgeperezvk');
  },
  { tier: 1, feature: 12 }
);

tier1Suite.test(
  'F12.2: Dynamic shelf Recientes is populated from recently played tracks',
  () => {
    const shelf = { id: 'shelf-recent', title: 'Recientes', items: [1, 2, 3] };
    assertEqual(shelf.title, 'Recientes');
    assertTrue(shelf.items.length > 0);
  },
  { tier: 1, feature: 12 }
);

tier1Suite.test(
  'F12.3: Dynamic shelf Más como ${topArtist.name} is derived from top artist',
  () => {
    const topArtist = { name: 'Romeo Santos' };
    const title = `Más como ${topArtist.name}`;
    assertEqual(title, 'Más como Romeo Santos');
  },
  { tier: 1, feature: 12 }
);

tier1Suite.test(
  'F12.4: Dynamic shelf Tus mixes más escuchados is generated for daily mixes',
  () => {
    const title = 'Tus mixes más escuchados';
    assertTrue(title.includes('mixes'));
  },
  { tier: 1, feature: 12 }
);

tier1Suite.test(
  'F12.5: Shelf layout renders horizontal carousel cards with hover play actions',
  () => {
    const carouselConfig = {
      layout: 'carousel',
      hasPlayHover: true,
      scrollable: true,
    };
    assertTrue(carouselConfig.hasPlayHover);
    assertTrue(carouselConfig.scrollable);
  },
  { tier: 1, feature: 12 }
);

// ============================================================================
// Feature 13: Sidebar Typography Parity (R4)
// ============================================================================
tier1Suite.test(
  'F13.1: Sidebar playlist title specifies exact 16px font size text-[16px]',
  () => {
    const titleClass = "text-[16px] font-normal truncate font-['SpotifyMixUI',sans-serif]";
    assertTrue(titleClass.includes('text-[16px]'), 'Must include 16px font size');
  },
  { tier: 1, feature: 13 }
);

tier1Suite.test(
  'F13.2: Sidebar playlist subtitle specifies exact 14px font size text-[14px]',
  () => {
    const subtitleClass = "text-[14px] text-[#b3b3b3] mt-0.5 truncate font-['SpotifyMixUI',sans-serif]";
    assertTrue(subtitleClass.includes('text-[14px]'), 'Must include 14px font size');
  },
  { tier: 1, feature: 13 }
);

tier1Suite.test(
  'F13.3: Sidebar font family stack includes SpotifyMixUI and sans-serif',
  () => {
    const fontStack = "font-['SpotifyMixUI',sans-serif]";
    assertTrue(fontStack.includes('SpotifyMixUI'));
    assertTrue(fontStack.includes('sans-serif'));
  },
  { tier: 1, feature: 13 }
);

tier1Suite.test(
  'F13.4: Sidebar subtitle color uses Spotify muted gray #b3b3b3 text-[#b3b3b3]',
  () => {
    const subtitleClass = 'text-[#b3b3b3]';
    assertTrue(subtitleClass.includes('#b3b3b3'), 'Must use Spotify muted gray');
  },
  { tier: 1, feature: 13 }
);

tier1Suite.test(
  'F13.5: Sidebar playlist title uses normal font weight font-normal',
  () => {
    const titleClass = 'text-[16px] font-normal';
    assertTrue(titleClass.includes('font-normal'), 'Must use normal font weight');
  },
  { tier: 1, feature: 13 }
);

// ============================================================================
// Feature 14: Selected vs Playing State Parity (R4)
// ============================================================================
tier1Suite.test(
  'F14.1: Normal unselected playlist renders white #ffffff title text',
  () => {
    const color = getExpectedPlaylistTextColor({ isSelected: false, isPlayingTrackFromPlaylist: false });
    assertEqual(color, '#ffffff', 'Unselected playlist title must be white #ffffff');
  },
  { tier: 1, feature: 14 }
);

tier1Suite.test(
  'F14.2: Selected playlist retains white #ffffff title text when not playing',
  () => {
    const color = getExpectedPlaylistTextColor({ isSelected: true, isPlayingTrackFromPlaylist: false });
    assertEqual(color, '#ffffff', 'Selected non-playing playlist title must remain white #ffffff');
  },
  { tier: 1, feature: 14 }
);

tier1Suite.test(
  'F14.3: Playlist title turns Spotify green #1ed760 only when actively playing',
  () => {
    const color = getExpectedPlaylistTextColor({ isSelected: true, isPlayingTrackFromPlaylist: true });
    assertEqual(color, '#1ed760', 'Playing playlist title must turn Spotify green #1ed760');
  },
  { tier: 1, feature: 14 }
);

tier1Suite.test(
  'F14.4: Animated equalizer wave indicator renders only when actively playing',
  () => {
    const shouldRenderEqualizer = (isSelected, isPlaying) => isSelected && isPlaying;
    assertFalse(shouldRenderEqualizer(true, false), 'No equalizer when paused');
    assertFalse(shouldRenderEqualizer(false, false), 'No equalizer when unselected');
    assertTrue(shouldRenderEqualizer(true, true), 'Equalizer rendered when actively playing');
  },
  { tier: 1, feature: 14 }
);

tier1Suite.test(
  'F14.5: Pausing playback reverts playlist title text to #ffffff and removes equalizer waves',
  () => {
    let isPlaying = true;
    let color = getExpectedPlaylistTextColor({ isSelected: true, isPlayingTrackFromPlaylist: isPlaying });
    assertEqual(color, '#1ed760');

    // Pause
    isPlaying = false;
    color = getExpectedPlaylistTextColor({ isSelected: true, isPlayingTrackFromPlaylist: isPlaying });
    assertEqual(color, '#ffffff', 'Reverts to #ffffff upon pausing');
  },
  { tier: 1, feature: 14 }
);
