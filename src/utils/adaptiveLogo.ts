/**
 * Adaptive Logo and Device Detector
 *
 * - Mobile: Uses the icon with the sleek black background frame around the Spotify circle (icon-mobile-192.png / icon-mobile.png)
 * - Desktop: Uses ONLY THE LOGO (pure transparent green Spotify circle, favicon.svg / icon-desktop.png)
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
      favicon.href = '/icon-mobile-192.png';
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
