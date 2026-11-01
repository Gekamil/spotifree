import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-key');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    return res.end();
  }

  const query = req.query || {};
  let body = {};
  if (req.body) {
    try {
      body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    } catch {
      body = {};
    }
  }

  const text = (query.text || body.text || '').trim();
  const voice = query.voice || body.voice || 'es-MX-DaliaNeural'; // Default: Spotify DJ Livi persona
  const provider = (query.provider || body.provider || 'edge').toLowerCase();
  const apiKey = query.apiKey || body.apiKey || req.headers['x-api-key'] || process.env.TTS_API_KEY || '';

  if (!text) {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ error: 'Text parameter is required' }));
  }

  // 1. OpenAI TTS integration (if provider === 'openai' and key present)
  if (provider === 'openai' && apiKey) {
    try {
      const openAiRes = await fetch('https://api.openai.com/v1/audio/speech', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'tts-1',
          input: text,
          voice: query.voice || body.voice || 'alloy',
          response_format: 'mp3',
        }),
      });

      if (!openAiRes.ok) {
        throw new Error(`OpenAI TTS returned ${openAiRes.status}`);
      }

      const buffer = Buffer.from(await openAiRes.arrayBuffer());
      res.statusCode = 200;
      res.setHeader('Content-Type', 'audio/mpeg');
      res.setHeader('Content-Length', buffer.length);
      res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=86400');
      return res.end(buffer);
    } catch (err) {
      console.warn('[OpenAI TTS Failed, falling back to Edge]:', err);
    }
  }

  // 2. ElevenLabs integration (if provider === 'elevenlabs' and key present)
  if (provider === 'elevenlabs' && apiKey) {
    try {
      const voiceId = query.voiceId || body.voiceId || '21m00Tcm4TlvDq8ikWAM';
      const elRes = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
        method: 'POST',
        headers: {
          'xi-api-key': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text,
          model_id: 'eleven_multilingual_v2',
        }),
      });

      if (!elRes.ok) {
        throw new Error(`ElevenLabs TTS returned ${elRes.status}`);
      }

      const buffer = Buffer.from(await elRes.arrayBuffer());
      res.statusCode = 200;
      res.setHeader('Content-Type', 'audio/mpeg');
      res.setHeader('Content-Length', buffer.length);
      res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=86400');
      return res.end(buffer);
    } catch (err) {
      console.warn('[ElevenLabs TTS Failed, falling back to Edge]:', err);
    }
  }

  // 3. Cartesia Sonic integration (if provider === 'cartesia' and key present)
  if (provider === 'cartesia' && apiKey) {
    try {
      const cartesiaRes = await fetch('https://api.cartesia.ai/tts/bytes', {
        method: 'POST',
        headers: {
          'X-API-Key': apiKey,
          'Cartesia-Version': '2024-06-10',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model_id: 'sonic-multilingual',
          transcript: text,
          voice: {
            mode: 'id',
            id: query.voiceId || body.voiceId || 'fb35c138-04f8-47bc-ad9f-f3c5ad7ad186',
          },
          output_format: {
            container: 'mp3',
            encoding: 'mp3',
            sample_rate: 24000,
          },
        }),
      });

      if (!cartesiaRes.ok) {
        throw new Error(`Cartesia TTS returned ${cartesiaRes.status}`);
      }

      const buffer = Buffer.from(await cartesiaRes.arrayBuffer());
      res.statusCode = 200;
      res.setHeader('Content-Type', 'audio/mpeg');
      res.setHeader('Content-Length', buffer.length);
      res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=86400');
      return res.end(buffer);
    } catch (err) {
      console.warn('[Cartesia TTS Failed, falling back to Edge]:', err);
    }
  }

  // 4. Default High-Fidelity Edge Neural Voice with Prosody Optimization
  try {
    const tts = new MsEdgeTTS();
    await tts.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);

    // Natural human radio pacing: +2% rate, +0Hz pitch for fluid speech
    const { audioStream } = tts.toStream(text, {
      rate: '+2%',
      pitch: '+0Hz',
      volume: '+0%',
    });

    const chunks = [];
    audioStream.on('data', (chunk) => chunks.push(chunk));
    audioStream.on('end', () => {
      const buffer = Buffer.concat(chunks);
      res.statusCode = 200;
      res.setHeader('Content-Type', 'audio/mpeg');
      res.setHeader('Content-Length', buffer.length);
      res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=86400');
      res.end(buffer);
    });
    audioStream.on('error', (err) => {
      console.error('[TTS Stream Error]:', err);
      if (!res.headersSent) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: 'Audio stream failed', details: err?.message || String(err) }));
      }
    });
  } catch (err) {
    console.error('[TTS Handler Error]:', err);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'TTS synthesis error', details: err?.message || String(err) }));
    }
  }
}
