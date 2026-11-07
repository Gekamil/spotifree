/**
 * AI DJ brain: session recommendations, transition lines and segment intros.
 *
 * Providers (first that works wins):
 *   1. Groq   - process.env.groqapi / GROQAPI / GROQ_API_KEY ...
 *   2. Gemini - process.env.GEMINI_API_KEY / gemini / GOOGLE_API_KEY
 *
 * Model names change over time (Groq retires models every few months), so instead of a
 * hard-coded model the available list is fetched once per warm instance and the best
 * match is picked. When everything fails the response says why (`reason`) so it can be
 * diagnosed from the browser, and the client falls back to its local DJ lines.
 */

function getGroqApiKey() {
  return (
    process.env.groqapi ||
    process.env.GROQAPI ||
    process.env.GROQ_API_KEY ||
    process.env.groq_api_key ||
    process.env.GROQ_KEY ||
    process.env.groqkey ||
    ''
  );
}

function getGeminiApiKey() {
  return process.env.GEMINI_API_KEY || process.env.gemini || process.env.GEMINI || process.env.GOOGLE_API_KEY || '';
}

const NOISE_FILTER_REGEX = /\b(ruido\s+blanco|white\s+noise|ruido\s+rosa|pink\s+noise|ruido\s+marr[oó]n|brown\s+noise|green\s+noise|static\s+noise|sonido(s)?\s+de\s+(lluvia|agua|olas|mar|viento|tormenta|ventilador|secador|aspiradora|reloj)|(rain|water|ocean|waves|storm|fan|wind)\s+sound(s)?|ambient\s+noise|binaural\s+beat(s)?|ondas\s+(alfa|delta|theta|gamma)|sleep\s+sound(s)?|sonido(s)?\s+para\s+dormir|deep\s+sleep|baby\s+sleep|nature\s+sound(s)?|sound\s+effects?|test\s+tone|\d+\s*hz\b)\b/i;

function cleanPunchySpeech(text) {
  if (!text) return '';
  return text
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/["“”«»*]/g, '')
    .replace(/\.{2,}/g, '.')
    .replace(/[—–]/g, ' ')
    .replace(/[()[\]{}]/g, '')
    .replace(/,\s*([!¡?¿])/g, ' $1')
    .replace(/;+/g, '.')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractJson(text) {
  if (!text) return null;
  const cleaned = text.replace(/<think>[\s\S]*?<\/think>/gi, '').replace(/```json|```/g, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch {}
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start >= 0 && end > start) {
    try {
      return JSON.parse(cleaned.slice(start, end + 1));
    } catch {}
  }
  return null;
}

// ---------------------------------------------------------------------------
// Groq
// ---------------------------------------------------------------------------
const GROQ_SMART = [
  'llama-3.3-70b-versatile',
  'openai/gpt-oss-120b',
  'meta-llama/llama-4-maverick-17b-128e-instruct',
  'moonshotai/kimi-k2-instruct',
  'openai/gpt-oss-20b',
  'meta-llama/llama-4-scout-17b-16e-instruct',
  'llama-3.1-8b-instant',
];
const GROQ_FAST = [
  'llama-3.1-8b-instant',
  'openai/gpt-oss-20b',
  'meta-llama/llama-4-scout-17b-16e-instruct',
  'llama-3.3-70b-versatile',
  'openai/gpt-oss-120b',
];
let groqModelsCache = null; // { at, ids }

async function listGroqModels(apiKey) {
  if (groqModelsCache && Date.now() - groqModelsCache.at < 30 * 60 * 1000) return groqModelsCache.ids;
  try {
    const r = await fetch('https://api.groq.com/openai/v1/models', {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout?.(2500),
    });
    if (!r.ok) {
      const err = new Error(`models HTTP ${r.status}`);
      err.status = r.status;
      throw err;
    }
    const data = await r.json();
    const ids = (data.data || [])
      .filter((m) => m && m.id && m.active !== false)
      .map((m) => m.id)
      .filter((id) => !/whisper|guard|tts|playai|distil|orpheus|compound|prompt-guard/i.test(id));
    groqModelsCache = { at: Date.now(), ids };
    return ids;
  } catch (e) {
    if (e && (e.status === 401 || e.status === 403)) throw e;
    return null; // unknown: just try the preference list
  }
}

function pickModels(available, preference) {
  if (!available || available.length === 0) return preference.slice(0, 3);
  const picked = preference.filter((m) => available.includes(m));
  for (const id of available) {
    if (picked.length >= 3) break;
    if (!picked.includes(id)) picked.push(id);
  }
  return picked.slice(0, 3);
}

async function groqChat({ apiKey, system, user, json, maxTokens, temperature, fast, timeoutMs, deadline }) {
  const available = await listGroqModels(apiKey);
  const models = pickModels(available, fast ? GROQ_FAST : GROQ_SMART);
  let lastErr = 'no model';
  for (const model of models) {
    const left = deadline - Date.now();
    if (left < 900) {
      lastErr = `sin tiempo (${lastErr})`;
      break;
    }
    timeoutMs = Math.min(timeoutMs, left);
    try {
      const body = {
        model,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        temperature,
        max_tokens: maxTokens,
      };
      if (json) body.response_format = { type: 'json_object' };
      if (/gpt-oss/.test(model)) body.reasoning_effort = 'low';
      const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout?.(timeoutMs),
      });
      if (!r.ok) {
        let detail = '';
        try {
          const e = await r.json();
          detail = e?.error?.code || e?.error?.message || '';
        } catch {}
        lastErr = `HTTP ${r.status} ${String(detail).slice(0, 80)} (${model})`;
        if (r.status === 401 || r.status === 403) break; // bad key: other models won't help
        continue;
      }
      const data = await r.json();
      const content = data.choices?.[0]?.message?.content || '';
      if (content.trim()) return { content, model: `groq:${model}` };
      lastErr = `empty (${model})`;
    } catch (e) {
      lastErr = `${e?.name === 'TimeoutError' ? 'timeout' : e?.message || 'error'} (${model})`;
    }
  }
  throw new Error(lastErr);
}

// ---------------------------------------------------------------------------
// Gemini
// ---------------------------------------------------------------------------
const GEMINI_PREF = ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.0-flash', 'gemini-flash-latest', 'gemini-2.0-flash-lite'];
let geminiModelsCache = null;

async function listGeminiModels(apiKey) {
  if (geminiModelsCache && Date.now() - geminiModelsCache.at < 30 * 60 * 1000) return geminiModelsCache.ids;
  try {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?pageSize=200&key=${encodeURIComponent(apiKey)}`, {
      signal: AbortSignal.timeout?.(2500),
    });
    if (!r.ok) return null;
    const data = await r.json();
    const ids = (data.models || [])
      .filter((m) => (m.supportedGenerationMethods || []).includes('generateContent'))
      .map((m) => String(m.name || '').replace(/^models\//, ''))
      .filter((id) => /flash/i.test(id) && !/image|tts|audio|live|vision|exp|thinking/i.test(id));
    geminiModelsCache = { at: Date.now(), ids };
    return ids;
  } catch {
    return null;
  }
}

async function geminiChat({ apiKey, system, user, json, maxTokens, temperature, timeoutMs, deadline }) {
  const available = await listGeminiModels(apiKey);
  const models = pickModels(available, GEMINI_PREF).slice(0, 2);
  let lastErr = 'no model';
  for (const model of models) {
    const left = deadline - Date.now();
    if (left < 900) {
      lastErr = `sin tiempo (${lastErr})`;
      break;
    }
    timeoutMs = Math.min(timeoutMs, left);
    try {
      const generationConfig = { temperature, maxOutputTokens: maxTokens };
      if (json) generationConfig.responseMimeType = 'application/json';
      if (/2\.5/.test(model)) generationConfig.thinkingConfig = { thinkingBudget: 0 };
      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: system }] },
            contents: [{ role: 'user', parts: [{ text: user }] }],
            generationConfig,
          }),
          signal: AbortSignal.timeout?.(timeoutMs),
        }
      );
      if (!r.ok) {
        lastErr = `HTTP ${r.status} (${model})`;
        if (r.status === 401 || r.status === 403) break;
        continue;
      }
      const data = await r.json();
      const content = (data.candidates?.[0]?.content?.parts || []).map((p) => p.text || '').join('');
      if (content.trim()) return { content, model: `gemini:${model}` };
      lastErr = `empty (${model})`;
    } catch (e) {
      lastErr = `${e?.name === 'TimeoutError' ? 'timeout' : e?.message || 'error'} (${model})`;
    }
  }
  throw new Error(lastErr);
}

/** Runs the prompt on the first provider that answers. */
async function llmChat(rawOpts) {
  // Whole request (both providers, retries included) stays well inside the function limit
  const opts = { ...rawOpts, deadline: Date.now() + rawOpts.timeoutMs + 2500 };
  const reasons = [];
  const groqKey = getGroqApiKey();
  if (groqKey) {
    try {
      return await groqChat({ ...opts, apiKey: groqKey });
    } catch (e) {
      reasons.push(`groq: ${e.message}`);
    }
  } else {
    reasons.push('groq: sin clave');
  }
  const geminiKey = getGeminiApiKey();
  if (geminiKey) {
    try {
      // Gemini gets its own short window even if Groq used up the first one
      return await geminiChat({ ...opts, apiKey: geminiKey, deadline: Math.max(opts.deadline, Date.now() + Math.min(5000, rawOpts.timeoutMs)) });
    } catch (e) {
      reasons.push(`gemini: ${e.message}`);
    }
  } else {
    reasons.push('gemini: sin clave');
  }
  const err = new Error(reasons.join(' | '));
  err.reasons = reasons;
  throw err;
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  let body = {};
  if (req.method === 'POST') {
    try {
      body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    } catch {
      body = req.body || {};
    }
  } else {
    body = req.query || {};
  }

  const action = body.action || 'speech'; // 'speech' | 'recommend' | 'transition' | 'segment' | 'status'
  const prompt = String(body.prompt || '').trim().slice(0, 300);
  const userName = String(body.userName || '').trim().slice(0, 40);
  const currentTrack = body.currentTrack || null;
  const nextTrack = body.nextTrack || null;
  const userProfile = body.userProfile || null;
  const userGreeting = userName ? `, ${userName}` : '';

  if (action === 'status') {
    try {
      const r = await llmChat({ system: 'Responde solo: ok', user: 'ok', json: false, maxTokens: 5, temperature: 0, fast: true, timeoutMs: 4000 });
      return res.status(200).json({ success: true, model: r.model });
    } catch (e) {
      return res.status(200).json({ success: false, reason: e.message });
    }
  }

  // Listener profile context
  let profileSection = '';
  if (userProfile && typeof userProfile === 'object') {
    const parts = [];
    if (Array.isArray(userProfile.topArtists) && userProfile.topArtists.length > 0) {
      parts.push(`Artistas más escuchados por este usuario: ${userProfile.topArtists.slice(0, 8).join(', ')}`);
    }
    if (Array.isArray(userProfile.recentTracks) && userProfile.recentTracks.length > 0) {
      parts.push(`Canciones escuchadas recientemente: ${userProfile.recentTracks.slice(0, 6).map((t) => `${t.name} (${t.artist})`).join(', ')}`);
    }
    if (Array.isArray(userProfile.topGenres) && userProfile.topGenres.length > 0) {
      parts.push(`Estilos y géneros preferidos: ${userProfile.topGenres.join(', ')}`);
    }
    if (Array.isArray(userProfile.likedTracks) && userProfile.likedTracks.length > 0) {
      parts.push(`Canciones que le gustan: ${userProfile.likedTracks.slice(0, 6).map((t) => `${t.name} (${t.artist})`).join(', ')}`);
    }
    if (parts.length > 0) {
      profileSection = `\n\nPERFIL MUSICAL DEL OYENTE (lo que realmente escucha):\n${parts.join('\n')}\nINSTRUCCIÓN FUNDAMENTAL: Adapta el estilo, los artistas y la selección musical a este perfil específico del oyente, salvo que pida explícitamente un género diferente.`;
    }
  }

  // Real facts the DJ may mention (sent by the app). The DJ must never invent others.
  const ctx = body.context && typeof body.context === 'object' ? body.context : {};
  const clip = (v, n) => String(v || '').trim().slice(0, n);
  const facts = [];
  if (ctx.timeOfDay) facts.push(`Momento: ${clip(ctx.weekday, 12)} por la ${clip(ctx.timeOfDay, 12)}`);
  if (ctx.releaseYear) facts.push(`La canción salió en ${clip(ctx.releaseYear, 4)}`);
  if (ctx.album) facts.push(`Es del álbum "${clip(ctx.album, 60)}"`);
  if (ctx.topArtist) facts.push(`El artista que más escucha el oyente: ${clip(ctx.topArtist, 50)}`);
  if (ctx.isTopArtist) facts.push('Esta canción es de uno de sus artistas favoritos');
  const factsSection = facts.length
    ? `\n\nDATOS REALES que puedes usar (como mucho uno, solo si queda natural; no inventes ningún otro dato, año, récord ni anécdota):\n- ${facts.join('\n- ')}`
    : '';
  // Accent of the chosen voice
  const DIALECT = {
    mx: 'español de México, natural y cercano',
    co: 'español de Colombia, alegre',
    ve: 'español de Venezuela, animado',
    es: 'español de España, natural',
  };
  const dialect = DIALECT[clip(ctx.voiceRegion, 2)] || DIALECT.es;

  const isEnglish =
    body.language === 'en' ||
    (/\b(the|is|in|for|and|to|play|music|songs|vibes|rock|chill|party|workout|morning|night|rap|pop|hiphop|electronic|summer|winter)\b/i.test(prompt) &&
      !/[áéíóúñ¿¡]/i.test(prompt) &&
      !/\b(de|el|la|los|las|musica|canciones|para|con|por)\b/i.test(prompt));

  const DJ_SYSTEM_PROMPT = isEnglish
    ? `You are Spotifree's AI DJ: a warm, witty radio host who knows the listener's taste.
RULES FOR A NATURAL SYNTHETIC VOICE:
1. Very short sentences (8 to 12 words each). Maximum 2 sentences, 25 words in total.
2. Never use ellipses, long dashes, parentheses, emojis or hashtags.
3. Mention the song or artist by name when you have it. Sound like a person, not an ad.
4. Reply ONLY with the exact words to say out loud.`
    : `Eres el DJ de Spotifree: un locutor cercano, con gracia y que conoce los gustos del oyente. Hablas ${dialect}.
REGLAS PARA QUE LA VOZ SINTÉTICA SUENE NATURAL:
1. Frases muy cortas (8 a 12 palabras). Máximo 2 frases y 25 palabras en total.
2. Nunca uses puntos suspensivos, guiones largos, paréntesis, emojis ni hashtags.
3. Si tienes el nombre de la canción o del artista, menciónalo. Suena a persona, no a anuncio.
4. Responde SOLO con las palabras exactas que vas a decir en voz alta.`;

  try {
    // ─── RECOMMENDATIONS & SESSION ───
    if (action === 'recommend') {
      const recSystemPrompt = isEnglish
        ? `${DJ_SYSTEM_PROMPT}
Build a personalized music session from the request and the listener's real taste.
Output ONLY valid JSON:
{
  "speech": "short DJ intro (max 22 words) that names the first song",
  "vibeTitle": "short session title",
  "vibeColor": "#vibrant_hex_color",
  "tracks": [ { "title": "Song Title", "artist": "Artist" } ]
}
Include 12 to 15 real, existing songs. Mix favourites of their artists with a few fitting discoveries. Order them so the energy flows.`
        : `${DJ_SYSTEM_PROMPT}
Crea una sesión musical personalizada a partir de la petición y del gusto real del oyente.
Devuelve SOLO un JSON válido:
{
  "speech": "intro corta del DJ (máximo 22 palabras) que nombre la primera canción",
  "vibeTitle": "título corto de la sesión",
  "vibeColor": "#color_hex_vibrante",
  "tracks": [ { "title": "Nombre de canción", "artist": "Artista" } ]
}
Incluye de 12 a 15 canciones reales que existan. Mezcla temas de sus artistas con algunos descubrimientos que encajen. Ordénalas para que la energía fluya.`;

      const r = await llmChat({
        system: recSystemPrompt,
        user: `Usuario${userGreeting}. Petición: "${prompt}".${profileSection}\nCrea la sesión ideal para este oyente.`,
        json: true,
        maxTokens: 900,
        temperature: 0.7,
        fast: false,
        timeoutMs: 7000,
      });
      const parsed = extractJson(r.content);
      if (parsed && (parsed.speech || Array.isArray(parsed.tracks))) {
        parsed.speech = cleanPunchySpeech(parsed.speech || '');
        if (Array.isArray(parsed.tracks)) {
          parsed.tracks = parsed.tracks.filter((t) => {
            if (!t) return false;
            const title = String(t.title || '').trim();
            const artist = String(t.artist || '').trim();
            if (!title || !artist) return false;
            return !NOISE_FILTER_REGEX.test(`${title} ${artist}`);
          });
        }
        return res.status(200).json({ success: true, model: r.model, ...parsed });
      }
      return res.status(200).json({ success: false, useFallback: true, reason: `JSON no válido (${r.model})` });
    }

    // ─── SEGMENT INTRO (DJ talks before a block of songs) ───
    if (action === 'segment') {
      const kind = String(body.kind || '').slice(0, 40);
      const reason = String(body.reason || '').slice(0, 160);
      const title = String(currentTrack?.name || '').slice(0, 80);
      const artist = String(currentTrack?.artists?.[0]?.name || '').slice(0, 60);
      const r = await llmChat({
        system: DJ_SYSTEM_PROMPT,
        user: isEnglish
          ? `Introduce the next block of songs${userGreeting}. Block: ${kind}. Why: ${reason}. First song: "${title}" by ${artist}. One or two short sentences.${factsSection}`
          : `Presenta el siguiente bloque de canciones${userGreeting}. Bloque: ${kind}. Motivo: ${reason}. Primera canción: "${title}" de ${artist}. Una o dos frases cortas.${factsSection}`,
        json: false,
        maxTokens: 90,
        temperature: 0.85,
        fast: true,
        timeoutMs: 3500,
      });
      const speech = cleanPunchySpeech(r.content);
      if (speech) return res.status(200).json({ success: true, model: r.model, speech });
    }

    // ─── TRANSITION COMMENTARY ───
    if (action === 'transition') {
      const curTitle = currentTrack?.name || '';
      const curArtist = currentTrack?.artists?.[0]?.name || '';
      const nextTitle = nextTrack?.name || '';
      const nextArtist = nextTrack?.artists?.[0]?.name || '';
      const transPrompt = isEnglish
        ? curTitle
          ? `Just played "${curTitle}" by ${curArtist || 'this artist'}${nextTitle ? ` and now comes "${nextTitle}" by ${nextArtist}` : ''}. Short radio DJ link between them.`
          : `The listener finished a block of songs. Invite them to keep going with more music they will love.`
        : curTitle
        ? `Acaba de sonar "${curTitle}" de ${curArtist || 'este artista'}${nextTitle ? ` y ahora viene "${nextTitle}" de ${nextArtist}` : ''}. Enlace corto de DJ de radio entre las dos.`
        : `El oyente ha terminado un bloque de canciones. Invítale a seguir con más música que le va a encantar.`;
      const r = await llmChat({ system: DJ_SYSTEM_PROMPT, user: transPrompt + factsSection, json: false, maxTokens: 90, temperature: 0.8, fast: true, timeoutMs: 3500 });
      const speech = cleanPunchySpeech(r.content);
      if (speech) return res.status(200).json({ success: true, model: r.model, speech });
    }

    // ─── GENERAL SPEECH ───
    const r = await llmChat({
      system: DJ_SYSTEM_PROMPT,
      user: isEnglish
        ? `The listener${userGreeting} said: "${prompt}". Introduce the music with energy.`
        : `El oyente${userGreeting} te ha dicho: "${prompt}". Preséntale la música con energía.`,
      json: false,
      maxTokens: 90,
      temperature: 0.8,
      fast: true,
      timeoutMs: 3500,
    });
    const speech = cleanPunchySpeech(r.content);
    if (speech) return res.status(200).json({ success: true, model: r.model, speech });
  } catch (err) {
    console.warn('[api/groq] AI unavailable, client will use local DJ lines:', err.message);
    return res.status(200).json({ success: false, useFallback: true, reason: String(err.message || 'error').slice(0, 300) });
  }

  return res.status(200).json({ success: false, useFallback: true, reason: 'respuesta vacía' });
}
