import React, { useState } from 'react';
import { aiDJVoiceService, type AIDJConfig } from '../../services/aiDJVoiceService';

interface AIDJSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AIDJSettingsModal: React.FC<AIDJSettingsModalProps> = ({ isOpen, onClose }) => {
  const currentConfig = aiDJVoiceService.getConfig();
  const [voice, setVoice] = useState(currentConfig.voice);
  const [provider, setProvider] = useState<AIDJConfig['provider']>(currentConfig.provider);
  const [apiKey, setApiKey] = useState(currentConfig.apiKey || '');
  const [voiceId, setVoiceId] = useState(currentConfig.voiceId || '');
  const [isTesting, setIsTesting] = useState(false);

  if (!isOpen) return null;

  const handleSave = () => {
    aiDJVoiceService.setConfig({
      voice,
      provider,
      apiKey: apiKey.trim(),
      voiceId: voiceId.trim(),
    });
    onClose();
  };

  const handleTestVoice = async () => {
    setIsTesting(true);
    // Temporary apply config for test
    aiDJVoiceService.setConfig({
      voice,
      provider,
      apiKey: apiKey.trim(),
      voiceId: voiceId.trim(),
    });

    const testPhrases: Record<string, string> = {
      'es-MX-DaliaNeural': '¡Qué onda! Soy DJ Livi. Aquí tienes la mejor música en Spotify.',
      'es-ES-AlvaroNeural': '¡Qué pasa! Aquí DJ Álvaro, listo para meterle caña a tu sesión.',
      'es-ES-ElviraNeural': 'Hola, soy Elvira. Vamos a relajarnos con buena música hoy.',
      'es-CO-SalomeNeural': '¡Hola! Aquí Salomé. Vamos a disfrutar de unos temazos increíbles.',
      'en-US-AndrewMultilingualNeural': "Hey, what's up! It's your personal DJ here on Spotify. Let's roll.",
    };

    const phrase = testPhrases[voice] || '¡Hola! Probando la voz de tu DJ personal.';
    await aiDJVoiceService.speak(phrase, {
      onEnd: () => setIsTesting(false),
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in font-['SpotifyMixUI']">
      <div className="relative w-full max-w-md bg-[#181818] border border-white/10 rounded-2xl p-6 text-white shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div>
            <h2 className="text-lg font-bold font-['SpotifyMixUITitle']">Configuración del DJ</h2>
            <p className="text-xs text-[#a7a7a7]">Personaliza la voz y el motor de inteligencia artificial</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/15 text-[#a7a7a7] hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="py-4 space-y-4 max-h-[70vh] overflow-y-auto pr-1">
          {/* 1. Voice Persona */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-[#a7a7a7] mb-2">
              Voz del DJ
            </label>
            <div className="space-y-2">
              {[
                { id: 'es-MX-DaliaNeural', label: 'DJ Livi (Recomendada)', desc: 'Español (México) • Voz suave, natural y carismática de Spotify' },
                { id: 'es-ES-AlvaroNeural', label: 'DJ Álvaro', desc: 'Español (España) • Locutor dinámico y enérgico' },
                { id: 'es-ES-ElviraNeural', label: 'DJ Elvira', desc: 'Español (España) • Tono cercano y elegante' },
                { id: 'es-CO-SalomeNeural', label: 'DJ Salomé', desc: 'Español (Colombia) • Ritmo fresco y vibrante' },
                { id: 'en-US-AndrewMultilingualNeural', label: 'DJ X (English)', desc: 'Inglés (EE.UU.) • Voz original de Spotify DJ' },
              ].map((v) => (
                <div
                  key={v.id}
                  onClick={() => setVoice(v.id)}
                  className={`p-3 rounded-xl border cursor-pointer transition-all ${
                    voice === v.id
                      ? 'bg-white/10 border-[#1ed760] text-white shadow-[0_0_15px_rgba(30,215,96,0.15)]'
                      : 'bg-[#242424] border-transparent hover:bg-[#2a2a2a] text-[#b3b3b3]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-white">{v.label}</span>
                    {voice === v.id && <span className="w-2 h-2 rounded-full bg-[#1ed760]" />}
                  </div>
                  <p className="text-xs text-[#a7a7a7] mt-0.5">{v.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* 2. AI Provider (Optional) */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-[#a7a7a7] mb-2">
              Motor de Voz
            </label>
            <select
              value={provider}
              onChange={(e) => setProvider(e.target.value as any)}
              className="w-full bg-[#242424] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#1ed760]"
            >
              <option value="edge">Motor Neuronal Integrado (100% Gratis e Ilimitado)</option>
              <option value="openai">OpenAI TTS (Requiere API Key de OpenAI)</option>
              <option value="cartesia">Cartesia Sonic (Ultra-rápido, con respiraciones)</option>
              <option value="elevenlabs">ElevenLabs (Calidad estudio)</option>
            </select>
          </div>

          {/* API Key input if custom provider */}
          {provider !== 'edge' && (
            <div className="p-3 bg-[#242424] rounded-xl border border-white/10 space-y-2">
              <label className="block text-xs font-semibold text-white">
                API Key de {provider.toUpperCase()}
              </label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={`Pega tu clave de ${provider}...`}
                className="w-full bg-[#181818] border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder:text-[#777] focus:outline-none focus:border-[#1ed760]"
              />
              {(provider === 'elevenlabs' || provider === 'cartesia') && (
                <div>
                  <label className="block text-xs font-semibold text-white mt-1">
                    ID de Voz (Opcional)
                  </label>
                  <input
                    type="text"
                    value={voiceId}
                    onChange={(e) => setVoiceId(e.target.value)}
                    placeholder="ID de voz personalizado..."
                    className="w-full bg-[#181818] border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder:text-[#777] focus:outline-none focus:border-[#1ed760]"
                  />
                </div>
              )}
              <p className="text-[11px] text-[#a7a7a7]">
                Se guarda únicamente en tu navegador de forma segura.
              </p>
            </div>
          )}

          {/* Info about Free Providers like Groq / Gemini */}
          <div className="p-3 bg-white/5 rounded-xl border border-white/5 text-xs text-[#a7a7a7] space-y-1">
            <span className="font-bold text-white">💡 ¿Quieres voces premium o IA con usos gratis?</span>
            <p>
              Puedes registrarte gratis en <strong>Google AI Studio</strong> (1.500 peticiones/día) o en <strong>Groq</strong> (7.000 peticiones/día de Whisper) iniciando sesión con tu cuenta de Google o GitHub en segundos.
            </p>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-4 border-t border-white/10">
          <button
            onClick={handleTestVoice}
            disabled={isTesting}
            className="px-4 py-2 rounded-full border border-white/20 text-xs font-bold text-white hover:bg-white/10 transition-all cursor-pointer disabled:opacity-50"
          >
            {isTesting ? 'Reproduciendo...' : 'Probar voz'}
          </button>

          <button
            onClick={handleSave}
            className="px-6 py-2 rounded-full bg-[#1ed760] text-black font-extrabold text-xs hover:scale-105 active:scale-95 transition-all cursor-pointer"
          >
            Guardar cambios
          </button>
        </div>
      </div>
    </div>
  );
};
