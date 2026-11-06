/**
 * App icon selector ("Icono de la app").
 *
 * - Android APK (Capacitor): switches the real launcher icon through the native
 *   `SpotifreeAppIcon` plugin (activity-alias per icon, see native/android-app-icons).
 * - Web in the browser: the chosen icon is applied to the favicon, apple-touch-icon and
 *   web manifest, so it is the one used when the user does "Añadir a pantalla de inicio".
 * - Already-installed PWA: the OS has fixed the icon, so the selector is hidden.
 *
 * All artwork comes from official Spotify logos (see public/app-icons/SOURCES.md).
 */
import { Capacitor, registerPlugin } from '@capacitor/core';

export type AppIconId =
  | 'default'
  | 'disco-2026'
  | 'anniversary-20'
  | 'black-2024'
  | 'classic-2015'
  | 'retro-2013'
  | 'original-2008';

export interface AppIconOption {
  id: AppIconId;
  name: string;
  period: string;
  preview: string;
}

export const APP_ICON_OPTIONS: AppIconOption[] = [
  { id: 'default', name: 'Spotifree', period: 'Predeterminado', preview: '/icon-mobile-192.png' },
  { id: 'disco-2026', name: 'Disco', period: '20 aniversario', preview: '/app-icons/variants/disco-2026/icon-maskable-192.png' },
  { id: 'anniversary-20', name: 'Spotify 20', period: '2026', preview: '/app-icons/variants/anniversary-20/icon-maskable-192.png' },
  { id: 'black-2024', name: 'Negro', period: '2024', preview: '/app-icons/variants/black-2024/icon-maskable-192.png' },
  { id: 'classic-2015', name: 'Clásico', period: '2015 – 2024', preview: '/app-icons/variants/classic-2015/icon-maskable-192.png' },
  { id: 'retro-2013', name: 'Retro', period: '2013 – 2015', preview: '/app-icons/variants/retro-2013/icon-maskable-192.png' },
  { id: 'original-2008', name: 'Original', period: '2008 – 2012', preview: '/app-icons/variants/original-2008/icon-maskable-192.png' },
];

const STORAGE_KEY = 'spotifree_app_icon';
export const APP_ICON_CHANGED_EVENT = 'spotifree_app_icon_changed';

interface SpotifreeAppIconPlugin {
  setIcon(options: { name: AppIconId }): Promise<void>;
  getIcon(): Promise<{ name: AppIconId }>;
}

const NativeAppIcon = registerPlugin<SpotifreeAppIconPlugin>('SpotifreeAppIcon');

export type AppIconPlatform = 'native' | 'installed-pwa' | 'browser';

export function getAppIconPlatform(): AppIconPlatform {
  try {
    if (Capacitor.isNativePlatform()) return 'native';
  } catch {}
  if (typeof window !== 'undefined') {
    const standalone =
      window.matchMedia?.('(display-mode: standalone)').matches ||
      window.matchMedia?.('(display-mode: fullscreen)').matches ||
      (navigator as any).standalone === true;
    if (standalone) return 'installed-pwa';
  }
  return 'browser';
}

function isValidId(id: unknown): id is AppIconId {
  return typeof id === 'string' && APP_ICON_OPTIONS.some((o) => o.id === id);
}

export function getSelectedAppIcon(): AppIconId {
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    if (isValidId(v)) return v;
  } catch {}
  return 'default';
}

/** Base path of the chosen web icon variant, or null for the default icon. */
export function getAppIconVariantBase(id: AppIconId = getSelectedAppIcon()): string | null {
  return id === 'default' ? null : `/app-icons/variants/${id}`;
}

export async function setSelectedAppIcon(id: AppIconId): Promise<void> {
  if (!isValidId(id)) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, id);
  } catch {}

  if (getAppIconPlatform() === 'native') {
    try {
      await NativeAppIcon.setIcon({ name: id });
    } catch (e) {
      console.warn('[AppIcon] Native icon switch not available:', e);
    }
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(APP_ICON_CHANGED_EVENT, { detail: { id } }));
  }
}

/** On app start in the APK, align the stored choice with the launcher's real icon. */
export async function syncNativeAppIcon(): Promise<void> {
  if (getAppIconPlatform() !== 'native') return;
  try {
    const { name } = await NativeAppIcon.getIcon();
    if (isValidId(name)) window.localStorage.setItem(STORAGE_KEY, name);
  } catch {}
}
