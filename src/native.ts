import { Capacitor } from '@capacitor/core';

// Native-only niceties, loaded lazily so the web build stays light.

const native = Capacitor.isNativePlatform();

export async function syncStatusBar(dark: boolean) {
  if (!native) return;
  const { StatusBar, Style } = await import('@capacitor/status-bar');
  await StatusBar.setStyle({ style: dark ? Style.Dark : Style.Light }).catch(() => {});
  if (Capacitor.getPlatform() === 'android') {
    await StatusBar.setBackgroundColor({ color: dark ? '#0d1120' : '#fffdf7' }).catch(() => {});
  }
}

export async function tick() {
  if (!native) return;
  const { Haptics, ImpactStyle } = await import('@capacitor/haptics');
  await Haptics.impact({ style: ImpactStyle.Light }).catch(() => {});
}

export async function setupNative() {
  if (!native) return;
  const { App } = await import('@capacitor/app');
  // Android back button: go back through the constellation, leave the app from the core.
  await App.addListener('backButton', () => {
    const atCore = !window.location.hash || window.location.hash === '#/' || window.location.hash === '#';
    if (atCore) void App.exitApp();
    else window.history.back();
  });
  const { SplashScreen } = await import('@capacitor/splash-screen');
  await SplashScreen.hide().catch(() => {});
}
