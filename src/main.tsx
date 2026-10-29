import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App.tsx';

console.log('Spotifree: main.tsx mounting root...');
const rootElement = document.getElementById('root');
if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}

// Register Service Worker for PWA background audio keepalive
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' })
      .then((reg) => {
        console.log('[SW] Registered, scope:', reg.scope);
        // Periodically ping SW to keep it alive while audio is playing
        setInterval(() => {
          if (navigator.serviceWorker.controller) {
            navigator.serviceWorker.controller.postMessage({ type: 'KEEP_ALIVE' });
          }
        }, 20000);
      })
      .catch((err) => {
        console.warn('[SW] Registration failed:', err);
      });
  });
}
