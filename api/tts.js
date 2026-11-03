import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';
import fs from 'node:fs';
import path from 'node:path';

// Helper to load .env.local in dev if not already in process.env
function getEnvKey(keyName) {
  if (process.env[keyName]) return process.env[keyName];
  try {
    const envPath = path.resolve(process.cwd(), '.env.local');
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf8');
      const regex = new RegExp(`${keyName}\\s*=\\s*(.+)`);
      const match = content.match(regex);
      if (match && match[1]) {
        process.env[keyName] = match[1].trim();
        return process.env[keyName];
      }
    }
  } catch {}
  return '';
}

/**
 * Azure Cognitive Services Speech REST API (Official 48kHz / 192kbps Studio Master Quality)
 * Requires AZURE_SPEECH_KEY in .env or passed as parameter
 */
async function synthesizeWithAzureSpeech(text, voice = 'es-VE-SebastianNeural', userApiKey = '', userRegion = '') {
  const apiKey = (userApiKey || '').trim() || getEnvKey('AZURE_SPEECH_KEY');
  const region = (userRegion || '').trim() || getEnvKey('AZURE_SPEECH_REGION') || 'eastus';
  if (!apiKey) throw new Error('AZURE_SPEECH_KEY is not configured');

  const locale = voice.split('-').slice(0, 2).join('-');
  const url = `https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`;
  const ssml = `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="${locale}">
    <voice name="${voice}">
      ${text}
    </voice>
  </speak>`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Ocp-Apim-Subscription-Key': apiKey,
      'Content-Type': 'application/ssml+xml',
      'X-Microsoft-OutputFormat': 'audio-48khz-192kbitrate-mono-mp3',
      'User-Agent': 'Spotifree-App',
    },
    body: ssml,
    signal: AbortSignal.timeout?.(12000),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Azure Speech API error ${response.status}: ${errText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return {
    buffer: Buffer.from(arrayBuffer),
    contentType: 'audio/mpeg',
  };
}

/**
 * Google Gemini Generative AI TTS
 */
async function synthesizeWithGemini(text, voice = 'Kore', userApiKey = '') {
  const apiKey = (userApiKey || '').trim() || getEnvKey('GEMINI_API_KEY');
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
                  style: 'natural and clear',
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


/**
 * Microsoft Edge Neural TTS with high-quality 24kHz 96kbps MP3 (Pristine studio voice, reliable on all browsers)
 */
async function synthesizeWithEdge(text, voice = 'es-VE-SebastianNeural', format = 'mp3') {
  const tts = new MsEdgeTTS();
  const selectedFormat = OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3;

  await tts.setMetadata(voice, selectedFormat);
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
  const requestedFormat = (query.format || body.format || 'opus').toLowerCase();
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
  const userVoiceId = (query.voiceId || body.voiceId || '').trim();
  const userAzureKey = (query.azureKey || body.azureKey || '').trim();
  const userAzureRegion = (query.azureRegion || body.azureRegion || '').trim();
  const geminiVoiceName = isEnglish ? 'Puck' : 'Kore';

  let result;
  try {
    // 1. Azure Cognitive Services directly if key is configured (48kHz / 192kbps studio master)
    if (!result && (userAzureKey || getEnvKey('AZURE_SPEECH_KEY'))) {
      try {
        result = await synthesizeWithAzureSpeech(text, edgeVoiceName, userAzureKey, userAzureRegion);
        res.setHeader('x-tts-provider', 'azure-speech-studio-48khz');
      } catch (azureErr) {
        console.warn('[Azure Speech API error, falling back to Edge]:', azureErr?.message || azureErr);
      }
    }

    // 2. If Gemini is requested
    if (!result && (selectedVoice === 'gemini' || rawProvider === 'gemini')) {
      try {
        result = await synthesizeWithGemini(text, geminiVoiceName, userApiKey);
        res.setHeader('x-tts-provider', 'gemini');
      } catch (geminiErr) {
        console.warn(`[Gemini TTS Fallback to Edge (${edgeVoiceName})]:`, geminiErr?.message || geminiErr);
        result = await synthesizeWithEdge(text, edgeVoiceName, 'mp3');
        res.setHeader('x-tts-provider', 'edge-fallback');
        if (String(geminiErr?.message || '').includes('429') || String(geminiErr?.message || '').includes('Rate limit')) {
          res.setHeader('x-gemini-quota-exceeded', 'true');
        }
      }
    }

    // 3. High-fidelity Edge Neural TTS with MP3 (zero failure rate, instant 24kHz natural voice)
    if (!result) {
      result = await synthesizeWithEdge(text, edgeVoiceName, 'mp3');
      res.setHeader('x-tts-provider', 'edge-mp3-studio');
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
      const emergency = await synthesizeWithEdge(text, edgeVoiceName, 'mp3');
      res.statusCode = 200;
      res.setHeader('Content-Type', emergency.contentType);
      res.setHeader('Content-Length', emergency.buffer.length);
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
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
