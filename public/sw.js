// Minimal service worker — exists only to satisfy browsers' installability
// requirement. Deliberately does NOT cache anything: this is a dynamic,
// per-user dashboard app, so caching API/Firestore-backed responses would
// serve stale or cross-account data.
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", () => {
  // Network pass-through — no caching.
});
