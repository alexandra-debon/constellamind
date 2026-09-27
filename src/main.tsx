import { Capacitor } from '@capacitor/core';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { setupNative } from './native';
import { StoreProvider } from './store';
import './styles.css';

void setupNative();

// Offline support for the web version installed on the home screen. Skipped in
// the iOS/Android apps (files are already local) and during development.
if (import.meta.env.PROD && 'serviceWorker' in navigator && !Capacitor.isNativePlatform() && location.protocol === 'https:') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <StoreProvider fallback={<div className="boot" aria-hidden="true" />}>
      <App />
    </StoreProvider>
  </StrictMode>,
);
