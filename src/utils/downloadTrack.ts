/**
 * "Descargar": one option for both things the app used to offer separately —
 * the song is kept inside the app (plays in airplane mode) and the same audio is saved as a
 * file on the device. Removing the download removes the copy inside the app.
 */
import type { Track } from '../types/spotify';
import { deleteDownloadedTrack, downloadTrackAudio, saveTrackAsMp3File } from './offlineStorage';

function toast(message: string) {
  try {
    window.dispatchEvent(new CustomEvent('spotifree:toast', { detail: { message } }));
  } catch {}
}

export async function downloadTrackEverywhere(track: Track): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    toast('Modo avión: conéctate a internet para descargar canciones.');
    return false;
  }
  toast(`Descargando «${track.name}»…`);
  const ok = await downloadTrackAudio(track);
  if (!ok) {
    toast(`No se pudo extraer el audio de «${track.name}». Inténtalo de nuevo.`);
    return false;
  }
  // Same audio (already in the app) also saved as a file on the device
  const savedFile = await saveTrackAsMp3File(track).catch(() => false);
  toast(
    savedFile
      ? `«${track.name}» descargada: suena en modo avión y guardada en tu dispositivo`
      : `«${track.name}» descargada para escuchar sin conexión`
  );
  return true;
}

export async function removeTrackDownload(track: Track): Promise<void> {
  await deleteDownloadedTrack(track.id);
  toast(`Descarga eliminada: ${track.name}`);
}
