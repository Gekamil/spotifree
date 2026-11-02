/**
 * Spotifree Canvas API Proxy
 * Directly serves /api/canvas requests
 */
import metadataHandler from './metadata.js';

export default async function handler(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  req.query = { ...Object.fromEntries(url.searchParams.entries()), action: 'canvas' };
  return metadataHandler(req, res);
}
