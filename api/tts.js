import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';
import fs from 'node:fs';
import path from 'node:path';

// Helper to load .env.local in dev if not already in process.env
function getGeminiApiKey() {
  if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY;
  try {
    const envPath = path.resolve(process.cwd(), '.env.local');
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf8');
      const match = content.match(/GEMINI_API_KEY\s*=\s*(.+)/);
      if (match && match[1]) {
        process.env.GEMINI_API_KEY = match[1].trim();
        return process.env.GEMINI_API_KEY;
      }
    }
  } catch {}
  return '';
}

async function synthesizeWithGemini(text, voice = 'Kore', userApiKey = '') {
  const apiKey = (userApiKey || '').trim() || getGeminiApiKey();
  if (!apiKey) throw new Error('GEMINI_API_KEY is not configured');

  const url = 'https://generativelanguage.googleapis.com/v1beta/interactions';
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify({
      model: 'gemini-3.8-flash-tts',
      input: [
        {
          type: 'user_input',
          content: [
            {
              type: 'text',
              text: text,
              annotations: [
                {
                  type: 'speech_metadata',
                  style: 'enthusiastic radio host',
                },
              ],
            },
          ],
        },
      ],
      response_format: { type: 'audio' },
      generation_config: {
        speech_config: [{ voice: voice || 'Kore' }],
      },
    }),
    signal: AbortSignal.timeout?.(12000),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini TTS API error ${response.status}: ${errorText}`);
  }

  const data = await response.json();
  const step = data?.steps?.[0];
  const audioItem = step?.content?.find((c) => c.type === 'audio' || c.mime_type?.startsWith('audio') || c.data);
  if (!audioItem || !audioItem.data) {
    throw new Error('Gemini TTS response did not contain audio data');
  }

  return {
    buffer: Buffer.from(audioItem.data, 'base64'),
    contentType: audioItem.mime_type || 'audio/wav',
  };
}

async function synthesizeWithEdge(text, voice = 'es-VE-SebastianNeural') {
  const tts = new MsEdgeTTS();
  await tts.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);

  // Pure natural prosody without SSML distortion options
  const { audioStream } = tts.toStream(text);

  return new Promise((resolve, reject) => {
    const chunks = [];
    audioStream.on('data', (chunk) => chunks.push(chunk));
    audioStream.on('end', () => {
      resolve({
        buffer: Buffer.concat(chunks),
        contentType: 'audio/mpeg',
      });
    });
    audioStream.on('error', (err) => reject(err));
  });
}

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
  if (!text) {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ error: 'Text parameter is required' }));
  }

  const rawVoice = (query.voice || body.voice || '').toLowerCase();
  const rawProvider = (query.provider || body.provider || '').toLowerCase();
  const rawLang = (query.lang || body.lang || 'es').toLowerCase();
  const isEnglish = rawLang.startsWith('en');

  let selectedVoice = 'sebastian';
  if (rawVoice.includes('dalia') || rawVoice.includes('mexico') || rawVoice === 'es-mx-dalianeural') {
    selectedVoice = 'dalia';
  } else if (rawVoice.includes('sebastian') || rawVoice.includes('venezuela') || rawVoice === 'es-ve-sebastianneural') {
    selectedVoice = 'sebastian';
  } else if (rawVoice.includes('salome') || rawVoice.includes('colombia') || rawVoice === 'es-co-salomeneural' || rawVoice.includes('jenny')) {
    selectedVoice = 'salome';
  } else if (rawVoice.includes('alvaro') || rawVoice === 'es-es-alvaroneural' || rawVoice.includes('guy')) {
    selectedVoice = 'alvaro';
  } else if (rawVoice.includes('gemini') || rawProvider === 'gemini') {
    selectedVoice = 'gemini';
  }

  // Voice mapping based on language
  let edgeVoiceName = 'es-VE-SebastianNeural';
  if (isEnglish) {
    if (selectedVoice === 'dalia' || selectedVoice === 'salome') {
      edgeVoiceName = 'en-US-JennyNeural';
    } else {
      edgeVoiceName = 'en-US-GuyNeural';
    }
  } else {
    switch (selectedVoice) {
      case 'dalia':
        edgeVoiceName = 'es-MX-DaliaNeural';
        break;
      case 'sebastian':
        edgeVoiceName = 'es-VE-SebastianNeural';
        break;
      case 'salome':
        edgeVoiceName = 'es-CO-SalomeNeural';
        break;
      case 'alvaro':
        edgeVoiceName = 'es-ES-AlvaroNeural';
        break;
      case 'gemini':
      default:
        edgeVoiceName = 'es-VE-SebastianNeural';
        break;
    }
  }

  const userApiKey = (query.apiKey || body.apiKey || '').trim();
  const geminiVoiceName = isEnglish ? 'Puck' : 'Kore';

  let result;
  try {
    if (selectedVoice === 'gemini') {
      try {
        result = await synthesizeWithGemini(text, geminiVoiceName, userApiKey);
        res.setHeader('x-tts-provider', 'gemini');
      } catch (geminiErr) {
        console.warn(`[Gemini TTS Fallback to Edge (${edgeVoiceName})]:`, geminiErr?.message || geminiErr);
        result = await synthesizeWithEdge(text, edgeVoiceName);
        res.setHeader('x-tts-provider', 'edge-fallback');
        if (String(geminiErr?.message || '').includes('429') || String(geminiErr?.message || '').includes('Rate limit')) {
          res.setHeader('x-gemini-quota-exceeded', 'true');
        }
      }
    } else {
      result = await synthesizeWithEdge(text, edgeVoiceName);
      res.setHeader('x-tts-provider', 'edge');
    }

    res.statusCode = 200;
    res.setHeader('Content-Type', result.contentType);
    res.setHeader('Content-Length', result.buffer.length);
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.end(result.buffer);
  } catch (err) {
    console.error('[TTS Global Error]:', err);
    // Last-ditch emergency fallback
    try {
      const emergency = await synthesizeWithEdge(text, edgeVoiceName);
      res.statusCode = 200;
      res.setHeader('Content-Type', emergency.contentType);
      res.setHeader('Content-Length', emergency.buffer.length);
      res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=86400');
      res.end(emergency.buffer);
    } catch (finalErr) {
      if (!res.headersSent) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: 'TTS synthesis error', details: String(finalErr?.message || finalErr) }));
      }
    }
  }
}
