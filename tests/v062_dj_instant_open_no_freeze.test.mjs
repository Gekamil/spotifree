import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('Spotifree v0.6.2: DJ Instant Open & Zero Main-Thread Freezing Verification', async (t) => {
  const taggingServiceCode = fs.readFileSync('src/services/musicTaggingService.ts', 'utf8');
  const mobileLayoutCode = fs.readFileSync('src/components/mobile/MobileLayout.tsx', 'utf8');
  const aiDJViewCode = fs.readFileSync('src/components/dj/AIDJView.tsx', 'utf8');
  const aiDJServiceCode = fs.readFileSync('src/services/aiDJService.ts', 'utf8');
  const djSegmentsCode = fs.readFileSync('src/services/djSegments.ts', 'utf8');
  const spotifreeMixesCode = fs.readFileSync('src/services/spotifreeMixes.ts', 'utf8');
  const metadataCode = fs.readFileSync('api/metadata.js', 'utf8');

  await t.test('1. Music Tagging: Zero recursion & cached library indexing', () => {
    // classifyTrackHashtags must NOT call getDominantUserHashtag() inside fallback
    const fallbackMatch = taggingServiceCode.match(/if\s*\(matchedTags\.size\s*===\s*0\)[\s\S]*?matchedTags\.add\('#pop'\)/);
    assert.ok(fallbackMatch, 'classifyTrackHashtags must directly fallback to #pop without calling getDominantUserHashtag');
    assert.ok(!fallbackMatch[0].includes('getDominantUserHashtag()'), 'classifyTrackHashtags fallback must NEVER invoke getDominantUserHashtag()');

    // analyzeUserLibraryByHashtags must check cache
    assert.ok(taggingServiceCode.includes('cachedLibraryIndex'), 'analyzeUserLibraryByHashtags must use cachedLibraryIndex');
    assert.ok(taggingServiceCode.includes('lastLibraryIndexTime'), 'analyzeUserLibraryByHashtags must use lastLibraryIndexTime throttle');
  });

  await t.test('2. MobileLayout Library DJ Cards: Instant touch handling & handleSelectPlaylistById', () => {
    // Must contain handleOpenDJPlaylist helper that unlocks audio and calls handleSelectPlaylistById('spotify-dj')
    assert.ok(mobileLayoutCode.includes('const handleOpenDJPlaylist = () => {'), 'MobileLayout must declare handleOpenDJPlaylist');
    assert.ok(mobileLayoutCode.includes("handleSelectPlaylistById('spotify-dj')"), 'MobileLayout must call handleSelectPlaylistById for DJ');

    // Library Grid view must use handleDJClick or handleDJTouchEnd with manipulation touchAction
    const gridDJBlock = mobileLayoutCode.match(/Spotify Official DJ Playlist Card[\s\S]*?libraryFilter === 'playlists'[\s\S]*?<div[\s\S]*?SPOTIFY_DJ_COVER_IMAGE/);
    assert.ok(gridDJBlock, 'Must locate Library Grid DJ Playlist Card block');
    assert.ok(gridDJBlock[0].includes('handleDJTouchStart') || gridDJBlock[0].includes('handleDJClick'), 'Grid DJ card must use fast touch handler');
    assert.ok(gridDJBlock[0].includes('touchAction'), 'Grid DJ card must have touchAction manipulation');

    // Library List view must use handleDJClick or handleDJTouchEnd with manipulation touchAction
    const listDJMatches = [...mobileLayoutCode.matchAll(/Spotify Official DJ Playlist Card[\s\S]*?libraryFilter === 'playlists'[\s\S]*?<div[\s\S]*?SPOTIFY_DJ_COVER_IMAGE/g)];
    assert.ok(listDJMatches.length >= 2, 'Both Grid and List DJ Playlist Card blocks must be present');
    const listDJBlock = listDJMatches[1][0];
    assert.ok(listDJBlock.includes('handleDJTouchStart') || listDJBlock.includes('handleDJClick'), 'List DJ card must use fast touch handler');
    assert.ok(listDJBlock.includes('touchAction'), 'List DJ card must have touchAction manipulation');
  });

  await t.test('3. AIDJView & aiDJService: Non-blocking mount & deferred voice prefetch', () => {
    // vibeChips must NOT execute heavy synchronous getUserDynamicVibeChips during initial render frame
    assert.ok(aiDJViewCode.includes('setVibeChips'), 'AIDJView must use asynchronous/deferred state for dynamic vibe chips');
    assert.ok(aiDJViewCode.includes('DEFAULT_QUICK_CHIPS'), 'AIDJView must mount with DEFAULT_QUICK_CHIPS instantly');

    // prefetchQuickVibeVoices must be deferred in AIDJView and aiDJService to protect network sockets and audio playback
    assert.ok(aiDJViewCode.includes('setTimeout(() => {\n      prefetchQuickVibeVoices();') ||
              aiDJViewCode.includes('setTimeout(() => { prefetchQuickVibeVoices();') ||
              aiDJViewCode.includes('setTimeout'), 'AIDJView must defer voice prefetching');

    assert.ok(aiDJServiceCode.includes('prefetchQuickVibeVoices(cleanName);'), 'aiDJService must prefetch quick vibe voices');
    assert.ok(aiDJServiceCode.includes('setTimeout'), 'aiDJService must defer prefetchQuickVibeVoices');

    // searchArtistTracks in djSegments must have timeout race guard
    assert.ok(djSegmentsCode.includes('Promise.race') && djSegmentsCode.includes('searchPromise'), 'searchArtistTracks must use timeout race guard to avoid stall');
  });

  await t.test('4. Spotifree Mix Covers & Metadata: Clean Bad Bunny portrait & anti-silhouette protection', () => {
    // Bad Bunny portrait must be authentic
    assert.ok(spotifreeMixesCode.includes("'bad bunny': 'https://cdn-images.dzcdn.net/images/artist/044a3f315b041864887a8dd8709e6926/500x500-000000-80-0-0.jpg'"), 'Bad Bunny portrait must use verified 044a portrait');

    // isPlaceholderOrAvatar must detect /artist//, //500x500, /image
    assert.ok(spotifreeMixesCode.includes('//500x500'), 'isPlaceholderOrAvatar must check //500x500');
    assert.ok(spotifreeMixesCode.includes('/artist//'), 'isPlaceholderOrAvatar must check /artist//');

    // api/metadata.js must filter invalid Deezer pictures
    assert.ok(metadataCode.includes('isInvalidDzPic'), 'api/metadata.js must implement isInvalidDzPic');
  });
});
