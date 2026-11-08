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
  toast(`Descargando «${track.name}»…`);
  const ok = await downloadTrackAudio(track);
  if (!ok) {
    toast(`No se pudo descargar «${track.name}». Inténtalo de nuevo.`);
    return false;
  }
  // Same audio (already in the app) also saved as a file on the device
  await saveTrackAsMp3File(track).catch(() => false);
  toast(`«${track.name}» descargada: suena sin conexión y está guardada en tu dispositivo`);
  return true;
}

export async function removeTrackDownload(track: Track): Promise<void> {
  await deleteDownloadedTrack(track.id);
  toast(`Descarga eliminada: ${track.name}`);
}
