/**
 * Adaptive Logo and Device Detector
 *
 * - Mobile: Uses the official Spotify rounded green logo (icon-192.png / apple-touch-icon.png)
 * - Desktop: Uses the official vector Spotify green circle (favicon.svg / icon-desktop-192.png)
 */

export function isMobileDevice(): boolean {
  if (typeof window === 'undefined') return false;
  const ua = navigator.userAgent || '';
  const mobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i.test(ua);
  const mobileScreen = window.innerWidth <= 768;
  return mobileUA || mobileScreen;
}

export function updateDocumentFavicon(): void {
  if (typeof document === 'undefined') return;
  const mobile = isMobileDevice();
  const favicon = document.getElementById('app-favicon') as HTMLLinkElement | null;
  const appleIcon = document.getElementById('app-apple-icon') as HTMLLinkElement | null;

  if (mobile) {
    if (favicon) {
      favicon.type = 'image/png';
      favicon.href = '/icon-192.png';
    }
    if (appleIcon) {
      appleIcon.href = '/apple-touch-icon.png';
    }
  } else {
    if (favicon) {
      favicon.type = 'image/svg+xml';
      favicon.href = '/favicon.svg';
    }
    if (appleIcon) {
      appleIcon.href = '/icon-desktop-192.png';
    }
  }
}

// Automatically subscribe to window resize / orientation changes
if (typeof window !== 'undefined') {
  window.addEventListener('resize', updateDocumentFavicon);
  window.addEventListener('orientationchange', updateDocumentFavicon);
}
