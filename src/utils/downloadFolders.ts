/**
 * Spotifree Download & Local Audio Folder Organization System
 * Manages folders/subfolders for device music and offline downloads.
 * Authentic Spotify UI styling and full local persistence.
 */

export interface DownloadFolder {
  id: string;
  name: string;
  isDefault?: boolean;
  type: 'device' | 'downloads' | 'custom';
  createdAt: number;
}

export const FOLDER_DEVICE_ID = 'folder-device';
export const FOLDER_DOWNLOADS_ID = 'folder-downloads';
export const FOLDERS_STORAGE_KEY = 'spotifree_download_folders_v2';
export const TRACK_FOLDER_MAP_KEY = 'spotifree_track_folder_map_v2';
export const FOLDERS_CHANGED_EVENT = 'spotifree:download-folders-changed';

export const DEFAULT_FOLDERS: DownloadFolder[] = [
  {
    id: FOLDER_DEVICE_ID,
    name: 'Música del dispositivo',
    isDefault: true,
    type: 'device',
    createdAt: 0,
  },
  {
    id: FOLDER_DOWNLOADS_ID,
    name: 'Descargas de Spotifree',
    isDefault: true,
    type: 'downloads',
    createdAt: 1,
  },
];

/**
 * Dispatch an event when folders or track assignments change
 */
export function notifyFoldersChanged(): void {
  if (typeof window === 'undefined') return;
  try {
    window.dispatchEvent(new CustomEvent(FOLDERS_CHANGED_EVENT, { detail: { timestamp: Date.now() } }));
  } catch {}
}

/**
 * Subscribe to folder changes
 */
export function onFoldersChanged(callback: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const handler = () => callback();
  window.addEventListener(FOLDERS_CHANGED_EVENT, handler);
  return () => window.removeEventListener(FOLDERS_CHANGED_EVENT, handler);
}

/**
 * Read custom folders from localStorage
 */
function readCustomFolders(): DownloadFolder[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(FOLDERS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Save custom folders to localStorage
 */
function saveCustomFolders(folders: DownloadFolder[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(FOLDERS_STORAGE_KEY, JSON.stringify(folders));
  } catch {}
}

/**
 * Get all available folders: default folders first, followed by user-created subfolders
 */
export function getDownloadFolders(): DownloadFolder[] {
  const custom = readCustomFolders();
  return [...DEFAULT_FOLDERS, ...custom];
}

/**
 * Create a new custom subfolder
 */
export function createDownloadFolder(name: string): DownloadFolder {
  const cleanName = (name || '').trim() || 'Nueva carpeta';
  const custom = readCustomFolders();
  const newFolder: DownloadFolder = {
    id: `folder-custom-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    name: cleanName,
    isDefault: false,
    type: 'custom',
    createdAt: Date.now(),
  };
  custom.push(newFolder);
  saveCustomFolders(custom);
  notifyFoldersChanged();
  return newFolder;
}

/**
 * Rename an existing custom folder
 */
export function renameDownloadFolder(folderId: string, newName: string): boolean {
  if (folderId === FOLDER_DEVICE_ID || folderId === FOLDER_DOWNLOADS_ID) return false;
  const cleanName = (newName || '').trim();
  if (!cleanName) return false;

  const custom = readCustomFolders();
  const folder = custom.find((f) => f.id === folderId);
  if (!folder) return false;

  folder.name = cleanName;
  saveCustomFolders(custom);
  notifyFoldersChanged();
  return true;
}

/**
 * Delete a custom folder. Tracks previously inside this folder return to their default folder.
 */
export function deleteDownloadFolder(folderId: string): boolean {
  if (folderId === FOLDER_DEVICE_ID || folderId === FOLDER_DOWNLOADS_ID) return false;

  const custom = readCustomFolders().filter((f) => f.id !== folderId);
  saveCustomFolders(custom);

  // Clean up any track mappings pointing to this deleted folder
  const map = readTrackFolderMap();
  let changed = false;
  for (const [trackId, fId] of Object.entries(map)) {
    if (fId === folderId) {
      delete map[trackId];
      changed = true;
    }
  }
  if (changed) {
    saveTrackFolderMap(map);
  }

  notifyFoldersChanged();
  return true;
}

/**
 * Read track-to-folder mapping from localStorage
 */
function readTrackFolderMap(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(TRACK_FOLDER_MAP_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return typeof parsed === 'object' && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

/**
 * Save track-to-folder mapping to localStorage
 */
function saveTrackFolderMap(map: Record<string, string>): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(TRACK_FOLDER_MAP_KEY, JSON.stringify(map));
  } catch {}
}

/**
 * Determine which folder a track currently belongs to:
 * 1. Explicit folder assignment from user
 * 2. Default: Device audio -> "Música del dispositivo"
 * 3. Default: Online downloaded tracks -> "Descargas de Spotifree"
 */
export function getTrackFolderId(trackId: string): string {
  if (!trackId) return FOLDER_DOWNLOADS_ID;
  const map = readTrackFolderMap();
  const clean = trackId.replace(/^spotify:track:/i, '').split('?')[0].trim();
  
  const explicit = map[clean] || map[trackId];
  if (explicit) {
    // Verify folder still exists
    const folders = getDownloadFolders();
    if (folders.some((f) => f.id === explicit)) {
      return explicit;
    }
  }

  // Fallback defaults
  if (trackId.startsWith('local-dev-') || trackId.startsWith('local-')) {
    return FOLDER_DEVICE_ID;
  }
  return FOLDER_DOWNLOADS_ID;
}

/**
 * Move a track to a specific folder
 */
export function moveTrackToFolder(trackId: string, folderId: string): void {
  if (!trackId || !folderId) return;
  const clean = trackId.replace(/^spotify:track:/i, '').split('?')[0].trim();
  const map = readTrackFolderMap();
  map[clean] = folderId;
  map[trackId] = folderId;
  saveTrackFolderMap(map);
  notifyFoldersChanged();
}
