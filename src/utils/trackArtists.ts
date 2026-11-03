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
