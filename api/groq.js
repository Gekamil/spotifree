/**
 * Groq Ultra-Fast AI DJ Intelligence & Recommendation API
 * Powered by Groq's high-speed inference (Llama 3.3 70B & Llama 3.1 8B)
 * Reads process.env.groqapi (or GROQ_API_KEY / GROQAPI)
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

const NOISE_FILTER_REGEX = /\b(ruido\s+blanco|white\s+noise|ruido\s+rosa|pink\s+noise|ruido\s+marr[oó]n|brown\s+noise|green\s+noise|static\s+noise|sonido(s)?\s+de\s+(lluvia|agua|olas|mar|viento|tormenta|ventilador|secador|aspiradora|reloj)|(rain|water|ocean|waves|storm|fan|wind)\s+sound(s)?|ambient\s+noise|binaural\s+beat(s)?|ondas\s+(alfa|delta|theta|gamma)|sleep\s+sound(s)?|sonido(s)?\s+para\s+dormir|deep\s+sleep|baby\s+sleep|nature\s+sound(s)?|sound\s+effects?|test\s+tone|\d+\s*hz\b)\b/i;

function cleanPunchySpeech(text) {
  if (!text) return '';
  return text
    .replace(/["“”«»]/g, '')
    .replace(/\.{2,}/g, '.')
    .replace(/[—–]/g, ' ')
    .replace(/[()[\]{}]/g, '')
    .replace(/,\s*([!¡?¿])/g, ' $1')
    .replace(/;+/g, '.')
    .replace(/\s+/g, ' ')
    .trim();
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const apiKey = getGroqApiKey();
  if (!apiKey) {
    return res.status(200).json({
      success: false,
      error: 'groqapi variable not configured',
      useFallback: true,
    });
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

  const action = body.action || 'speech'; // 'speech' | 'recommend' | 'transition'
  const prompt = (body.prompt || '').trim();
  const userName = (body.userName || '').trim();
  const currentTrack = body.currentTrack || null;
  const nextTrack = body.nextTrack || null;
  const userProfile = body.userProfile || null;
  const userGreeting = userName ? `, ${userName}` : '';

  // Extract listener's musical profile context
  let profileSection = '';
  if (userProfile && typeof userProfile === 'object') {
    const parts = [];
    if (Array.isArray(userProfile.topArtists) && userProfile.topArtists.length > 0) {
      parts.push(`Artistas más escuchados por este usuario: ${userProfile.topArtists.slice(0, 8).join(', ')}`);
    }
    if (Array.isArray(userProfile.recentTracks) && userProfile.recentTracks.length > 0) {
      const recList = userProfile.recentTracks
        .slice(0, 6)
        .map((t) => `${t.name} (${t.artist})`)
        .join(', ');
      parts.push(`Canciones escuchadas recientemente: ${recList}`);
    }
    if (Array.isArray(userProfile.topGenres) && userProfile.topGenres.length > 0) {
      parts.push(`Estilos y géneros preferidos: ${userProfile.topGenres.join(', ')}`);
    }
    if (Array.isArray(userProfile.likedTracks) && userProfile.likedTracks.length > 0) {
      const likedList = userProfile.likedTracks
        .slice(0, 6)
        .map((t) => `${t.name} (${t.artist})`)
        .join(', ');
      parts.push(`Canciones que le gustan: ${likedList}`);
    }
    if (parts.length > 0) {
      profileSection = `\n\nPERFIL MUSICAL DEL OYENTE (lo que realmente escucha):\n${parts.join('\n')}\nINSTRUCCIÓN FUNDAMENTAL: Adapta el estilo, los artistas y la selección musical a este perfil específico del oyente, salvo que pida explícitamente un género diferente.`;
    }
  }

  const isEnglish =
    body.language === 'en' ||
    (/\b(the|is|in|for|and|to|play|music|songs|vibes|rock|chill|party|workout|morning|night|rap|pop|hiphop|electronic|summer|winter)\b/i.test(prompt) &&
      !/[áéíóúñ¿¡]/i.test(prompt) &&
      !/\b(de|el|la|los|las|musica|canciones|para|con|por)\b/i.test(prompt));

  const DJ_SYSTEM_PROMPT = isEnglish
    ? `You are Spotifree's official AI DJ, a charismatic, energetic English radio host.
CRITICAL RULES FOR SYNTHETIC VOICE NATURALNESS:
1. Speak in VERY SHORT, punchy sentences (maximum 8 to 12 words per sentence).
2. NEVER use ellipses ("..."), long dashes, or parentheses.
3. DO NOT use unnecessary mid-sentence commas that cause unnatural TTS pauses.
4. Total speech MUST NOT exceed 2 short sentences (maximum 20-25 words in total).
5. Bring high energy using natural hype exclamations ("Let's go!", "Turn it up!", "Hit play!").
6. Respond ONLY with the exact text to say out loud, no explanations.`
    : `Eres el DJ oficial de Spotifree, un locutor de radio musical joven, carismático y entusiasta en español.
REGLAS CRÍTICAS PARA LA ENTONACIÓN DE LA VOZ SINTÉTICA:
1. Habla en frases MUY CORTAS y directas (máximo 8 a 12 palabras por frase).
2. NUNCA uses puntos suspensivos ("..."), guiones largos ni paréntesis.
3. NO uses comas innecesarias dentro de las frases, porque provocan silencios o pausas artificiales en el sintetizador.
4. La intervención completa NO debe superar 2 frases cortas (máximo 20 a 25 palabras en total).
5. Dale viveza y entusiasmo usando exclamaciones naturales ("¡Vamos!", "¡Súbele!", "¡A disfrutar!").
6. Solo responde con el texto exacto a decir, sin introducciones ni explicaciones.`;

  try {
    // ─── ACTION 1: RECOMMENDATIONS & VIBE SET GENERATION ───
    if (action === 'recommend') {
      const recSystemPrompt = isEnglish
        ? `${DJ_SYSTEM_PROMPT}
Generate a personalized music session based on the user's request and listening history.
Various listeners enjoy diverse genres (global pop, rock, rap, electronic, indie, synthwave, lofi, etc.).
Analyze their favorite artists and listening patterns so recommendations are 100% tailored to them.
You MUST output a valid JSON with the following structure:
{
  "speech": "short punchy DJ intro phrase for the session (max 20 words, no ellipses)",
  "vibeTitle": "short session title (e.g. Session: Indie Night, Session: Synthwave Chill, Session: Pop Energy)",
  "vibeColor": "#vibrant_hex_color",
  "searchQuery": "optimized search query to find these tracks on Spotify or Deezer",
  "tracks": [
    { "title": "Song Title", "artist": "Artist" }
  ]
}
Include between 10 and 15 iconic tracks matching the vibe.`
        : `${DJ_SYSTEM_PROMPT}
Genera una sesión musical personalizada basada en la petición del usuario y su perfil de escucha real.
Ten en cuenta que distintos usuarios tienen gustos muy variados (pop internacional, rock, rap, música electrónica, reggaetón, indie, bachata, lofi, etc.).
Analiza su historial de escucha y artistas favoritos para que la recomendación sea 100% afín a este oyente en particular.
Debes devolver OBLIGATORIAMENTE un JSON válido con la siguiente estructura:
{
  "speech": "frase corta y directa del DJ para presentar la sesión (máximo 20 palabras, sin puntos suspensivos)",
  "vibeTitle": "título corto de la sesión (ej: Sesión: Noche Indie, Sesión: Flow Urbano, Sesión: Pop Energy, etc.)",
  "vibeColor": "#color_hex_vibrante",
  "searchQuery": "términos de búsqueda optimizados para encontrar estas canciones en Spotify o Deezer",
  "tracks": [
    { "title": "Nombre de canción", "artist": "Artista" }
  ]
}
Incluye entre 10 y 15 canciones emblemáticas que encajen a la perfección con la petición y el gusto del usuario.`;

      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [
            { role: 'system', content: recSystemPrompt },
            {
              role: 'user',
              content: `Usuario${userGreeting}. Petición: "${prompt}".${profileSection}\nCrea una sesión musical con canciones ideales para este oyente.`,
            },
          ],
          response_format: { type: 'json_object' },
          temperature: 0.65,
          max_tokens: 650,
        }),
        signal: AbortSignal.timeout?.(4000),
      });

      if (!response.ok) {
        throw new Error(`Groq HTTP ${response.status}`);
      }

      const data = await response.json();
      const rawContent = data.choices?.[0]?.message?.content || '{}';
      const parsed = JSON.parse(rawContent);

      if (parsed && parsed.speech) {
        parsed.speech = cleanPunchySpeech(parsed.speech);
        if (Array.isArray(parsed.tracks)) {
          parsed.tracks = parsed.tracks.filter((t) => {
            if (!t) return false;
            const title = (t.title || '').trim();
            const artist = (t.artist || '').trim();
            if (!title || !artist) return false;
            return !NOISE_FILTER_REGEX.test(`${title} ${artist}`);
          });
        }
        return res.status(200).json({ success: true, ...parsed });
      }
    }

    // ─── ACTION 2: TRANSITION COMMENTARY (Between tracks or sets) ───
    if (action === 'transition') {
      const curTitle = currentTrack?.name || '';
      const curArtist = currentTrack?.artists?.[0]?.name || '';
      const nextTitle = nextTrack?.name || '';
      const nextArtist = nextTrack?.artists?.[0]?.name || '';

      const transPrompt = isEnglish
        ? (curTitle
            ? `Just played "${curTitle}" by ${curArtist || 'this artist'}${nextTitle ? ` and now comes "${nextTitle}" by ${nextArtist}` : ''}. Give a super short, punchy radio DJ transition comment.`
            : `User finished a block of tracks. Invite them with high energy to continue with more great tracks.`)
        : (curTitle
            ? `Acaba de sonar "${curTitle}" de ${curArtist || 'este artista'}${nextTitle ? ` y ahora viene "${nextTitle}" de ${nextArtist}` : ''}. Haz un comentario corto de DJ de radio presentando el cambio.`
            : `El usuario ha terminado un bloque de canciones. Invítale con entusiasmo a continuar con 15 canciones más que le van a encantar.`);

      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'llama-3.1-8b-instant',
          messages: [
            { role: 'system', content: DJ_SYSTEM_PROMPT },
            { role: 'user', content: transPrompt },
          ],
          temperature: 0.7,
          max_tokens: 80,
        }),
        signal: AbortSignal.timeout?.(2500),
      });

      if (response.ok) {
        const data = await response.json();
        const speech = cleanPunchySpeech(data.choices?.[0]?.message?.content || '');
        if (speech) {
          return res.status(200).json({ success: true, speech });
        }
      }
    }

    // ─── ACTION 3: GENERAL SPEECH INTRO ───
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [
          { role: 'system', content: DJ_SYSTEM_PROMPT },
          {
            role: 'user',
            content: isEnglish
              ? `The listener${userGreeting} requested: "${prompt}". Introduce the session with high energy and rhythm.`
              : `El usuario${userGreeting} te ha dicho: "${prompt}". Preséntale la música con energía y entusiasmo.`,
          },
        ],
        temperature: 0.7,
        max_tokens: 80,
      }),
      signal: AbortSignal.timeout?.(2500),
    });

    if (response.ok) {
      const data = await response.json();
      const speech = cleanPunchySpeech(data.choices?.[0]?.message?.content || '');
      if (speech) {
        return res.status(200).json({ success: true, speech });
      }
    }
  } catch (err) {
    console.warn('[api/groq] Error, using fallback engine:', err.message);
  }

  return res.status(200).json({
    success: false,
    useFallback: true,
  });
}
