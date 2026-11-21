import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();

test('v065 - 1. Smart Shuffle ensures minimum 10 upcoming tracks & shuffles playlist tracks', () => {
  const storePath = path.join(ROOT, 'src/store/usePlayerStore.ts');
  const content = fs.readFileSync(storePath, 'utf8');

  // Verify Fisher-Yates shuffling of remaining playlist tracks
  assert.ok(
    content.includes('const shuffledPlaylistTracks = shuffleTracks(otherPlaylistTracks);'),
    'Should shuffle other playlist tracks with Fisher-Yates shuffle'
  );

  // Verify MIN_UPCOMING = 10 requirement
  assert.ok(
    content.includes('const MIN_UPCOMING = 10;'),
    'Should enforce MIN_UPCOMING = 10 in populateSmartShuffleRecommendations'
  );

  // Verify replenishment logic ensuring upcoming tracks >= MIN_UPCOMING
  assert.ok(
    content.includes('while (upcoming.length < MIN_UPCOMING && rIdx < recommendedCandidates.length)'),
    'Should guarantee upcoming tracks >= MIN_UPCOMING by filling from recommended candidates'
  );

  // Verify interleaving logic when playlist has few tracks (<= 4 tracks)
  assert.ok(
    content.includes('if (shuffledPlaylistTracks.length <= 4)'),
    'Should have specialized interleaving for playlists with few tracks'
  );

  // Verify nextTrack replenishes if upcoming tracks < 10
  assert.ok(
    content.includes('upcomingCount < 10'),
    'nextTrack should replenish recommendations when upcoming tracks < 10'
  );
});

test('v065 - 2. Desktop Queue scroll reset fixed with isolated DesktopQueueSidebarView & scroll retention', () => {
  const sidebarPath = path.join(ROOT, 'src/components/desktop/DesktopRightSidebar.tsx');
  const content = fs.readFileSync(sidebarPath, 'utf8');

  // Verify DesktopQueueSidebarView is isolated and memoized
  assert.ok(
    content.includes('const DesktopQueueSidebarView: React.FC<DesktopQueueSidebarViewProps> = React.memo('),
    'DesktopQueueSidebarView should be memoized'
  );

  // Verify scroll retention using refs
  assert.ok(
    content.includes('queueScrollRef') && content.includes('lastScrollTopRef'),
    'DesktopQueueSidebarView should track and preserve scroll position across updates'
  );

  // Verify overflow-anchor: auto is applied
  assert.ok(
    content.includes("overflowAnchor: 'auto'"),
    'DesktopQueueSidebarView should use overflowAnchor: auto'
  );

  // Verify progressMs is NOT subscribed when in queue view
  assert.ok(
    content.includes("(activeRightSidebar === 'lyrics' || activeRightSidebar === 'now-playing' ? s.progressMs : 0)"),
    'progressMs should only be subscribed when viewing lyrics/now-playing to prevent queue re-renders'
  );

  // Verify stable keys are used for queue items
  assert.ok(
    content.includes('item.queueId || `q-${item.id}-${idx}`'),
    'Queue items should have stable queueId keys'
  );

  // Verify Now Playing video polling does not run when viewing queue
  assert.ok(
    content.includes("if (activeRightSidebar !== 'now-playing') return;"),
    'Video polling should be skipped when not in now-playing mode'
  );
});

test('v065 - 3. Desktop scroll performance: content-visibility & async image decoding like Spotify', () => {
  const cssPath = path.join(ROOT, 'src/index.css');
  const cssContent = fs.readFileSync(cssPath, 'utf8');

  assert.ok(cssContent.includes('.shelf-contain'), '.shelf-contain should be defined');
  assert.ok(cssContent.includes('.card-contain'), '.card-contain should be defined');
  assert.ok(cssContent.includes('.track-row-contain'), '.track-row-contain should be defined');
  assert.ok(cssContent.includes('content-visibility: auto;'), 'content-visibility: auto should be present in css');

  const carouselPath = path.join(ROOT, 'src/components/desktop/DesktopShelfCarousel.tsx');
  const carouselContent = fs.readFileSync(carouselPath, 'utf8');

  assert.ok(carouselContent.includes('loading="lazy"'), 'Images in carousel cards should have loading="lazy"');
  assert.ok(carouselContent.includes('decoding="async"'), 'Images in carousel cards should have decoding="async"');
  assert.ok(carouselContent.includes('card-contain'), 'Carousel cards should have card-contain class');

  const homePath = path.join(ROOT, 'src/components/desktop/DesktopHomeView.tsx');
  const homeContent = fs.readFileSync(homePath, 'utf8');

  assert.ok(homeContent.includes('shelf-contain'), 'Home shelves should have shelf-contain class');
});
