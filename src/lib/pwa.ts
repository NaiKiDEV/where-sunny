// The service worker uses registerType: 'autoUpdate', so a fresh build skip-waits
// and reloads on its own - but only once the browser DETECTS the new worker. A
// standalone/installed PWA that stays open never re-checks by itself, so a new
// deploy only showed up after a manual relaunch or refresh. vite-plugin-pwa's
// auto-injected registerSW.js already does the registration and the autoUpdate
// reload; here we only nudge DETECTION so it happens without a relaunch - an
// hourly poll while the app is open, plus a check whenever it's refocused
// (installed PWAs are usually backgrounded, not closed, so visibility is the
// most reliable trigger).
const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000;

export function registerServiceWorker(): void {
  if (!('serviceWorker' in navigator)) return;

  // `ready` resolves with the registration the plugin's registerSW.js created,
  // once there is an active worker. In dev (no SW) it simply never resolves.
  navigator.serviceWorker.ready.then((registration) => {
    const checkForUpdate = () => {
      // Skip while a worker is mid-install, or when we're offline.
      if (registration.installing || !navigator.onLine) return;
      // update() re-fetches sw.js (the top-level script bypasses the HTTP cache);
      // if it changed, autoUpdate skip-waits and reloads the page.
      void registration.update().catch(() => {
        // Transient network error - the next tick or refocus retries.
      });
    };

    setInterval(checkForUpdate, UPDATE_CHECK_INTERVAL_MS);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') checkForUpdate();
    });
  });
}
