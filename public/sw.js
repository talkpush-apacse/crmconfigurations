// Minimal service worker for PWA installability.
// This app does NOT use offline caching — all data requires network access.
// The service worker exists solely to satisfy the PWA install criteria
// on browsers that require a registered service worker (notably Chrome on Android).

self.addEventListener("install", () => {
  // Activate immediately, skip waiting
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  // Claim all clients immediately
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", () => {
  // Pass through all requests to the network — no caching
  return;
});
