import { Capacitor } from '@capacitor/core';
import { useState } from 'react';
import { useStore } from '../store';
import { Icon } from './icons';

const KEY = 'constellamind:install-hint';

function platform(): 'ios' | 'android' | null {
  if (Capacitor.isNativePlatform()) return null;
  const standalone =
    window.matchMedia?.('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;
  if (standalone) return null;
  const ua = navigator.userAgent;
  // iPadOS reports itself as a Mac; touch support gives it away.
  if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return 'ios';
  if (/Android/.test(ua)) return 'android';
  return null;
}

/** Explains how to add the web app to the home screen, once, on phones and tablets. */
export function InstallHint() {
  const { t } = useStore();
  const [hidden, setHidden] = useState(() => {
    try {
      return localStorage.getItem(KEY) === 'done';
    } catch {
      return false;
    }
  });
  const p = platform();
  if (hidden || !p) return null;
  const close = () => {
    setHidden(true);
    try {
      localStorage.setItem(KEY, 'done');
    } catch {
      // private mode: the hint simply comes back next time
    }
  };
  return (
    <div className="install-hint card" role="note">
      <Icon name="share" size={22} />
      <p>{p === 'ios' ? t.install.ios : t.install.android}</p>
      <button type="button" className="x" aria-label={t.remove} onClick={close}>
        ×
      </button>
    </div>
  );
}
