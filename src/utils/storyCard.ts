/**
 * "Tarjeta para stories": a 1080x1920 image of a song (cover, title, artist and the lyric lines the
 * user picks) to share on Instagram / WhatsApp stories, like Spotify's share cards.
 */
import type { Track } from '../types/spotify';
import { toHDImage } from './formatters';

export const STORY_CARD_EVENT = 'spotifree:open-story-card';
export function openStoryCard(track: Track) {
  window.dispatchEvent(new CustomEvent(STORY_CARD_EVENT, { detail: { track } }));
}

export type StoryBackground = 'color' | 'cover';
const W = 1080;
const H = 1920;
const FONT = '"SpotifyMixUI", "Helvetica Neue", Arial, sans-serif';
const TITLE_FONT = '"SpotifyMixUITitle", "SpotifyMixUI", "Helvetica Neue", Arial, sans-serif';

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((ok) => {
    const im = new Image();
    im.crossOrigin = 'anonymous';
    im.onload = () => ok(im);
    im.onerror = () => ok(null);
    im.src = src;
  });
}

function shade(hex: string, f: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
  const n = m ? parseInt(m[1], 16) : 0x1db954;
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v * f)));
  return `rgb(${c((n >> 16) & 255)}, ${c((n >> 8) & 255)}, ${c(n & 255)})`;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Wraps text into lines that fit maxWidth (max `maxLines`, the last one with "…") */
function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = w;
    } else line = test;
  }
  if (line) lines.push(line);
  if (lines.length > maxLines) {
    const cut = lines.slice(0, maxLines);
    let last = cut[maxLines - 1];
    while (last && ctx.measureText(`${last}…`).width > maxWidth) last = last.slice(0, -1);
    cut[maxLines - 1] = `${last}…`;
    return cut;
  }
  return lines;
}

export interface StoryCardInput {
  track: Track;
  color: string;
  background: StoryBackground;
  lyricLines: string[];
}

export async function renderStoryCard({ track, color, background, lyricLines }: StoryCardInput): Promise<HTMLCanvasElement> {
  try {
    await (document as any).fonts?.ready;
  } catch {}
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d')!;
  const coverUrl = toHDImage(track.album?.images?.[0]?.url || '');
  const cover = coverUrl ? await loadImage(coverUrl) : null;

  // Background
  if (background === 'cover' && cover) {
    ctx.save();
    ctx.filter = 'blur(70px) saturate(1.3)';
    const s = Math.max(W / cover.width, H / cover.height) * 1.25;
    ctx.drawImage(cover, (W - cover.width * s) / 2, (H - cover.height * s) / 2, cover.width * s, cover.height * s);
    ctx.restore();
    ctx.fillStyle = 'rgba(0,0,0,0.38)';
    ctx.fillRect(0, 0, W, H);
  } else {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, shade(color, 1.05));
    g.addColorStop(1, shade(color, 0.35));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }

  // Card
  const hasLyrics = lyricLines.length > 0;
  const cardW = 840;
  const pad = 60;
  const coverSize = cardW - pad * 2;
  ctx.font = `bold 58px ${TITLE_FONT}`;
  const titleLines = wrap(ctx, track.name || '', cardW - pad * 2, 2);
  ctx.font = `bold 66px ${TITLE_FONT}`;
  const lyricWrapped = hasLyrics ? wrap(ctx, lyricLines.join(' '), cardW - pad * 2, 7) : [];
  const lyricBlock = hasLyrics ? 48 + lyricWrapped.length * 82 : 0;
  const cardH = pad + coverSize + 48 + titleLines.length * 68 + 56 + lyricBlock + pad + 70;
  const cardX = (W - cardW) / 2;
  const cardY = Math.max(120, (H - cardH) / 2);

  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.45)';
  ctx.shadowBlur = 60;
  ctx.shadowOffsetY = 20;
  roundRect(ctx, cardX, cardY, cardW, cardH, 36);
  ctx.fillStyle = shade(color, 0.42);
  ctx.fill();
  ctx.restore();

  // Cover
  let y = cardY + pad;
  ctx.save();
  roundRect(ctx, cardX + pad, y, coverSize, coverSize, 20);
  ctx.clip();
  if (cover) ctx.drawImage(cover, cardX + pad, y, coverSize, coverSize);
  else {
    ctx.fillStyle = '#282828';
    ctx.fillRect(cardX + pad, y, coverSize, coverSize);
  }
  ctx.restore();
  y += coverSize + 48;

  // Title + artist
  ctx.fillStyle = '#ffffff';
  ctx.textBaseline = 'top';
  ctx.font = `bold 58px ${TITLE_FONT}`;
  for (const l of titleLines) {
    ctx.fillText(l, cardX + pad, y);
    y += 68;
  }
  ctx.fillStyle = 'rgba(255,255,255,0.72)';
  ctx.font = `500 40px ${FONT}`;
  const artist = (track.artists || []).map((a) => a.name).join(', ');
  ctx.fillText(wrap(ctx, artist, cardW - pad * 2, 1)[0] || '', cardX + pad, y);
  y += 56;

  // Lyric lines
  if (hasLyrics) {
    y += 48;
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold 66px ${TITLE_FONT}`;
    for (const l of lyricWrapped) {
      ctx.fillText(l, cardX + pad, y);
      y += 82;
    }
  }

  // Brand: the app's official icon (public/icon-192.png) + name
  const by = cardY + cardH - pad - 34;
  const logo = await loadImage('/icon-192.png');
  if (logo) ctx.drawImage(logo, cardX + pad, by - 7, 48, 48);
  ctx.fillStyle = '#ffffff';
  ctx.font = `bold 34px ${TITLE_FONT}`;
  ctx.textBaseline = 'middle';
  ctx.fillText('Spotifree', cardX + pad + 62, by + 18);
  return c;
}
