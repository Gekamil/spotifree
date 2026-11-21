import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

test('Android Auto MediaService does not reset queue scroll on state/lyric updates', () => {
  const mediaServicePath = path.resolve('native/android/SpotifreeMediaService.java');
  assert.ok(fs.existsSync(mediaServicePath), 'SpotifreeMediaService.java should exist');

  const content = fs.readFileSync(mediaServicePath, 'utf8');

  // Verify lastAppliedQueueSig signature check in refreshQueue()
  assert.ok(
    content.includes('private String lastAppliedQueueSig = "";'),
    'Should declare lastAppliedQueueSig field'
  );
  assert.ok(
    content.includes('currentSig.equals(lastAppliedQueueSig)'),
    'Should compare currentSig with lastAppliedQueueSig'
  );
  assert.ok(
    content.includes('return; // Queue structure unchanged: skip notifyChildrenChanged'),
    'Should return early when queue structure is unchanged to prevent scroll reset'
  );

  // Verify stable activeQueueId instead of hardcoded -1
  assert.ok(
    content.includes('long activeQueueId = MediaSessionCompat.QueueItem.UNKNOWN_ID;'),
    'Should declare activeQueueId'
  );
  assert.ok(
    content.includes('sb.setActiveQueueItemId(activeQueueId);'),
    'Should set activeQueueItemId with computed activeQueueId'
  );
});

test('Mobile NowPlayingModal queue preserves scroll position and removes pointer capture', () => {
  const modalPath = path.resolve('src/components/mobile/MobileNowPlayingModal.tsx');
  assert.ok(fs.existsSync(modalPath), 'MobileNowPlayingModal.tsx should exist');

  const content = fs.readFileSync(modalPath, 'utf8');

  // Verify queueScrollTopRef is declared and tracked
  assert.ok(
    content.includes('const queueScrollTopRef = useRef<number>(0);'),
    'Should declare queueScrollTopRef'
  );

  // Verify queueContentProps is removed from the scrollable container
  assert.ok(
    !content.includes('{...queueContentProps}'),
    'queueContentProps should not be attached to the scrollable container'
  );

  // Verify onScroll tracks scrollTop and overflowAnchor is set
  assert.ok(
    content.includes('queueScrollTopRef.current = e.currentTarget.scrollTop;'),
    'onScroll should track scrollTop into queueScrollTopRef'
  );
  assert.ok(
    content.includes("overflowAnchor: 'auto'"),
    'Scroll container should have overflowAnchor set to auto'
  );

  // Verify unique key logic is used for queue items
  assert.ok(
    content.includes('key={itemKey}'),
    'Queue items should use unique and stable itemKey'
  );
  assert.ok(
    content.includes("itemKey = (t as any).queueId || `q-${t.id || 'track'}-${idx}`"),
    'itemKey should fall back to unique indexed ID'
  );
});
