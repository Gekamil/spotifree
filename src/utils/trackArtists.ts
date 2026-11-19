export interface ParsedArtist {
  id: string;
  name: string;
}

/**
 * Splits and cleans artist names from single strings, messy arrays, or combined strings like
 * "Romeo Santos, Prince Royce", "Feid ft. ATL Jacob", "Karol G & Shakira", etc.
 * Returns an array of clean, individually actionable artist objects.
 */
export function parseTrackArtists(
  artists?: Array<{ id?: string; name?: string }> | string | null
): ParsedArtist[] {
  if (!artists) return [{ id: 'art-unknown', name: 'Artista' }];

  const rawNames: string[] = [];

  if (typeof artists === 'string') {
    rawNames.push(artists);
  } else if (Array.isArray(artists)) {
    for (const a of artists) {
      if (a && typeof a.name === 'string') {
        rawNames.push(a.name);
      }
    }
  }

  if (rawNames.length === 0) {
    return [{ id: 'art-unknown', name: 'Artista' }];
  }

  const result: ParsedArtist[] = [];
  const seen = new Set<string>();

  for (const raw of rawNames) {
    // Regex splits by:
    // - Comma: `,`
    // - Slash with optional spaces: ` / ` or `/`
    // - Ampersand: ` & ` or `&`
    // - Featuring notations: ` feat. `, ` feat `, ` ft. `, ` ft `, ` featuring `
    // - Collaboration notations: ` with `, ` con `, ` x `, ` X ` (surrounded by spaces)
    const splitTokens = raw
      .split(/(?:,|\s+\/\s+|\s+&\s+|\s+(?:feat\.|feat|ft\.|ft|featuring|with|con|x|X)\s+)/gi)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    for (const token of splitTokens) {
      // Clean leading/trailing punctuation or parenthesis like "(with Drake)"
      const cleanName = token.replace(/^[(\[]|[)\]]$/g, '').trim();
      if (!cleanName) continue;

      const lowerKey = cleanName.toLowerCase();
      if (!seen.has(lowerKey)) {
        seen.add(lowerKey);
        const cleanId = 'art-' + lowerKey.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
        result.push({
          id: cleanId,
          name: cleanName,
        });
      }
    }
  }

  return result.length > 0 ? result : [{ id: 'art-unknown', name: 'Artista' }];
}

/**
 * Canonical artist name normalization for strict matching:
 * Lowercases, strips diacritics/accents, replaces punctuation with space, collapses whitespace.
 */
export function normalizeArtistName(s?: string | null): string {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Strict artist matcher:
 * Checks whether candidate artist is an authentic match for target artist.
 * Prevents lexical substring leakage where "Eterna" matches "Vibra Eterna" or vice-versa.
 */
export function isStrictArtistMatch(candidate?: string | null, target?: string | null): boolean {
  const normC = normalizeArtistName(candidate);
  const normT = normalizeArtistName(target);
  if (!normC || !normT) return false;
  if (normC === normT) return true;

  // Split candidate by standard collaboration delimiters into individual artist names
  const parsed = parseTrackArtists(candidate);
  for (const a of parsed) {
    if (normalizeArtistName(a.name) === normT) return true;
  }

  // Also check if target is a collaboration string
  const targetParsed = parseTrackArtists(target);
  if (targetParsed.length > 1) {
    for (const ta of targetParsed) {
      if (normalizeArtistName(ta.name) === normC) return true;
    }
  }

  return false;
}

/**
 * Verifies if any artist of a track strictly matches the target artist name.
 */
export function trackMatchesArtist(
  track?: { artists?: Array<{ name?: string }> | string | null } | null,
  targetArtist?: string | null
): boolean {
  if (!track || !targetArtist) return false;
  const targetNorm = normalizeArtistName(targetArtist);
  if (!targetNorm) return false;

  const artists = parseTrackArtists(track.artists);
  return artists.some((a) => normalizeArtistName(a.name) === targetNorm);
}

