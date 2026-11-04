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
  const userGreeting = userName ? `, ${userName}` : '';

  const DJ_SYSTEM_PROMPT = `Eres el DJ oficial de Spotifree, un locutor de radio musical joven, carismático y entusiasta en español.
REGLAS CRÍTICAS PARA LA ENTONACIÓN DE LA VOZ SINTÉTICA:
1. Habla en frases MUY CORTAS y directas (máximo 8 a 12 palabras por frase).
2. NUNCA uses puntos suspensivos ("..."), guiones largos ni paréntesis.
3. NO uses comas innecesarias dentro de las frases, porque provocan silencios o pausas artificiales en el sintetizador.
4. La intervención completa NO debe superar 2 frases cortas (máximo 25 palabras en total).
5. Dale viveza y entusiasmo usando exclamaciones naturales ("¡Vamos!", "¡Súbele!", "¡A disfrutar!").
6. Solo responde con el texto exacto a decir, sin introducciones ni explicaciones.`;

  try {
    // ─── ACTION 1: RECOMMENDATIONS & VIBE SET GENERATION ───
    if (action === 'recommend') {
      const recSystemPrompt = `${DJ_SYSTEM_PROMPT}
Genera una sesión musical personalizada basada en la petición del usuario.
Debes devolver OBLIGATORIAMENTE un JSON válido con la siguiente estructura:
{
  "speech": "frase corta y directa del DJ para presentar la sesión (máximo 20 palabras, sin puntos suspensivos)",
  "vibeTitle": "título corto de la sesión (ej: Sesión: Noche Urbana)",
  "vibeColor": "#color_hex_vibrante",
  "searchQuery": "términos de búsqueda optimizados para encontrar estas canciones en Spotify o Deezer",
  "tracks": [
    { "title": "Nombre de canción", "artist": "Artista" }
  ]
}
Incluye entre 10 y 15 canciones emblemáticas que encajen a la perfección con la petición.`;

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
              content: `Usuario${userGreeting}. Petición: "${prompt}". Crea una sesión con canciones ideales.`,
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
        return res.status(200).json({ success: true, ...parsed });
      }
    }

    // ─── ACTION 2: TRANSITION COMMENTARY (Between tracks or sets) ───
    if (action === 'transition') {
      const curTitle = currentTrack?.name || '';
      const curArtist = currentTrack?.artists?.[0]?.name || '';
      const nextTitle = nextTrack?.name || '';
      const nextArtist = nextTrack?.artists?.[0]?.name || '';

      const transPrompt = curTitle
        ? `Acaba de sonar "${curTitle}" de ${curArtist || 'este artista'}${nextTitle ? ` y ahora viene "${nextTitle}" de ${nextArtist}` : ''}. Haz un comentario corto de DJ de radio presentando el cambio.`
        : `El usuario ha terminado un bloque de canciones. Invítale con entusiasmo a continuar con 15 canciones más que le van a encantar.`;

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
            content: `El usuario${userGreeting} te ha dicho: "${prompt}". Preséntale la música con energía y entusiasmo.`,
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
