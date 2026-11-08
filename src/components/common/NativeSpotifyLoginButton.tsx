import { useState } from 'react';
import { isNativeSpotifyLoginAvailable, loginWithSpotifyNative } from '../../services/nativeSpotifyLogin';
import { getSavedSpotifreeAccount, syncSpotifreeAccount } from '../../services/spotifreeAuth';
import { showGlobalToast } from '../../utils/globalToast';
import { useLanguageStore } from '../../utils/i18n';
import { SpotifreeAuthCard } from './SpotifreeAuthCard';

/**
 * "Continuar con Spotify" (APK only): opens Spotify's own login inside the app and picks up the
 * session cookie automatically. Then, if there is no Spotifree account yet, it asks for an email
 * and password (like everyone else) so the same account, with its Spotify session, also works on
 * the web. Renders nothing on the web, where the cookie is still pasted by hand.
 */
export function NativeSpotifyLoginButton({
  onDone,
  onAskAccount,
  compact = false,
}: {
  onDone?: () => void;
  /** The email + password step is showing (a screen can hide its own login form meanwhile) */
  onAskAccount?: () => void;
  compact?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [askAccount, setAskAccount] = useState(false);
  const en = useLanguageStore((s) => s.language) === 'en';
  if (!isNativeSpotifyLoginAvailable()) return null;

  const run = async () => {
    setError(null);
    setBusy(true);
    try {
      const { name } = await loginWithSpotifyNative(en ? 'en' : 'es');
      showGlobalToast(en ? `Spotify connected${name ? ` as ${name}` : ''}` : `Spotify conectado${name ? ` como ${name}` : ''}`);
      // No Spotifree account yet: ask for email + password so the session also works on the web
      if (!getSavedSpotifreeAccount()) {
        setAskAccount(true);
        onAskAccount?.();
      } else onDone?.();
    } catch (e: any) {
      const msg = String(e?.message || e || '');
      if (!/cancel/i.test(msg)) setError(msg || (en ? 'Could not sign in.' : 'No se pudo iniciar sesión.'));
    } finally {
      setBusy(false);
    }
  };

  if (askAccount) {
    return (
      <div translate="no" className="w-full rounded-xl bg-[#1f1f1f] border border-white/10 p-4 space-y-3 animate-in fade-in zoom-in-95 duration-200">
        <div>
          <p className="text-[15px] font-bold text-white">{en ? 'Last step: your Spotifree account' : 'Último paso: tu cuenta de Spotifree'}</p>
          <p className="mt-1 text-[12px] text-[#a7a7a7] leading-snug">
            {en
              ? 'Your Spotify session is linked. Choose an email and password to sign in with the same account on the web.'
              : 'Tu sesión de Spotify ya está vinculada. Elige un correo y una contraseña para entrar con la misma cuenta desde la web.'}
          </p>
        </div>
        <SpotifreeAuthCard
          showCookieInput={false}
          initialMode="register"
          onAuthSuccess={async () => {
            // The freshly extracted cookie wins over an older one saved in the cloud
            const acc = getSavedSpotifreeAccount();
            const cookie = window.localStorage.getItem('user_spotify_cookie') || '';
            if (acc && cookie) {
              try {
                await syncSpotifreeAccount({ email: acc.email, uid: acc.uid, spotifyCookie: cookie });
              } catch {}
            }
            setAskAccount(false);
            onDone?.();
          }}
        />
      </div>
    );
  }

  return (
    <div translate="no" className="w-full">
      <button
        onClick={run}
        disabled={busy}
        className={`w-full flex items-center justify-center gap-2.5 rounded-full bg-[#1ed760] text-black font-bold transition-transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-70 ${
          compact ? 'py-2.5 text-sm' : 'py-3.5 text-[15px]'
        }`}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.476 10-10S17.523 2 12 2m4.586 14.424a.62.62 0 0 1-.857.207c-2.35-1.435-5.308-1.76-8.793-.963a.623.623 0 1 1-.277-1.215c3.808-.87 7.076-.496 9.722 1.115a.62.62 0 0 1 .207.857m1.226-2.72a.78.78 0 0 1-1.072.257c-2.687-1.652-6.785-2.131-9.965-1.166a.78.78 0 0 1-.453-1.491c3.632-1.102 8.147-.568 11.233 1.328a.78.78 0 0 1 .257 1.072m.105-2.835C14.692 8.95 9.375 8.775 6.297 9.71a.935.935 0 1 1-.543-1.79c3.532-1.073 9.404-.866 13.115 1.337a.935.935 0 0 1-.954 1.613" />
        </svg>
        {busy ? (en ? 'Loading your library…' : 'Cargando tu biblioteca…') : en ? 'Continue with Spotify' : 'Continuar con Spotify'}
      </button>
      <p className="mt-2 text-center text-[12px] text-[#a7a7a7]">
        {en
          ? "Sign in on Spotify's page. Your session is picked up automatically: no need to copy the cookie."
          : 'Inicia sesión en la página de Spotify. La sesión se recoge sola: no hace falta copiar la cookie.'}
      </p>
      {error && <p className="mt-2 text-center text-[13px] text-[#f3727f]">{error}</p>}
    </div>
  );
}
