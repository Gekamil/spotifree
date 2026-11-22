import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { DiscordRpcClient, DEFAULT_MUSIC_CLIENT_ID } from '../scripts/discordRpc.mjs';
import { createDiscordBridgeServer } from '../scripts/discordBridge.mjs';

test('v073: DiscordRpcClient formats rich music presence (type 2 Listening) perfectly', () => {
  const client = new DiscordRpcClient({ clientId: '714912685713424424' });

  const sampleTrack = {
    id: '4LRPiXqCikLlN15c3ySbp7',
    name: 'Ojitos Lindos',
    artists: [{ name: 'Bad Bunny' }, { name: 'Bomba Estéreo' }],
    album: { name: 'Un Verano Sin Ti' },
    duration_ms: 258000,
    coverUrl: 'https://i.scdn.co/image/ab67616d0000b27349d694203245f241a1bcaa70',
  };

  const activity = client.formatPresence({
    track: sampleTrack,
    isPlaying: true,
    progressMs: 30000,
  });

  assert.ok(activity, 'Activity payload must be generated');
  assert.equal(activity.type, 2, 'Activity type must be 2 (LISTENING)');
  assert.equal(activity.details, 'Ojitos Lindos', 'Details must contain song title');
  assert.equal(activity.state, 'Bad Bunny, Bomba Estéreo', 'State must contain artist names');
  assert.equal(activity.assets.large_image, sampleTrack.coverUrl, 'Large image must be track cover');
  assert.equal(activity.assets.large_text, 'Un Verano Sin Ti', 'Large text must be album name');
  assert.equal(activity.assets.small_text, 'Spotifree');
  assert.ok(activity.timestamps.start > 0, 'Start timestamp must be positive unix timestamp');
  assert.ok(activity.timestamps.end > activity.timestamps.start, 'End timestamp must be strictly after start');
  assert.equal(activity.timestamps.end - activity.timestamps.start, 258, 'Duration difference must match 258s');
  assert.equal(activity.buttons[0].label, 'Escuchar en Spotifree');
  assert.ok(activity.buttons[0].url.includes('4LRPiXqCikLlN15c3ySbp7'));
});

test('v073: DiscordRpcClient returns null when paused or no track to clear presence cleanly', () => {
  const client = new DiscordRpcClient();
  const pausedActivity = client.formatPresence({
    track: { name: 'Song', artists: ['Artist'] },
    isPlaying: false,
    progressMs: 0,
  });
  assert.equal(pausedActivity, null, 'Must return null when paused');

  const emptyActivity = client.formatPresence({
    track: null,
    isPlaying: true,
    progressMs: 0,
  });
  assert.equal(emptyActivity, null, 'Must return null when no track');
});

test('v073: createDiscordBridgeServer handles status, presence, clear, and config endpoints', async () => {
  const mockRpc = new DiscordRpcClient();
  const server = createDiscordBridgeServer(0, mockRpc);

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    // 1. GET /api/discord/status
    const statusRes = await fetch(`${baseUrl}/api/discord/status`);
    assert.equal(statusRes.status, 200);
    const statusData = await statusRes.json();
    assert.equal(statusData.status, 'ok');
    assert.equal(statusData.service, 'Spotifree Discord RPC Bridge');

    // 2. POST /api/discord/presence
    const presenceRes = await fetch(`${baseUrl}/api/discord/presence`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        track: { name: 'Tití Me Preguntó', artists: ['Bad Bunny'], duration_ms: 240000 },
        isPlaying: true,
        progressMs: 10000,
      }),
    });
    assert.equal(presenceRes.status, 200);
    const presenceData = await presenceRes.json();
    assert.equal(presenceData.success, true);
    assert.equal(mockRpc.currentTrack.name, 'Tití Me Preguntó');

    // 3. POST /api/discord/clear
    const clearRes = await fetch(`${baseUrl}/api/discord/clear`, { method: 'POST' });
    assert.equal(clearRes.status, 200);
    assert.equal(mockRpc.currentTrack, null);

    // 4. POST /api/discord/config
    const configRes = await fetch(`${baseUrl}/api/discord/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId: '999999999999999999' }),
    });
    assert.equal(configRes.status, 200);
    assert.equal(mockRpc.clientId, '999999999999999999');
  } finally {
    mockRpc.destroy();
    server.close();
  }
});

test('v073: server.mjs and package.json include discord bridge integration', () => {
  const pkgContent = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  assert.ok(pkgContent.scripts.discord, 'package.json must contain "discord" script');

  const serverContent = fs.readFileSync('server.mjs', 'utf8');
  assert.ok(serverContent.includes('/api/discord/status'), 'server.mjs must route /api/discord/status');
  assert.ok(serverContent.includes('/api/discord/presence'), 'server.mjs must route /api/discord/presence');
  assert.ok(serverContent.includes('discordRpc.connect()'), 'server.mjs must connect discordRpc on listen');
});
