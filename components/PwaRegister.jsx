"use client";

import { useEffect } from "react";

// Mounted once from the root layout so the app is installable from any
// page, not just Settings — the Settings page's "Install App" button
// listens for the browser's own beforeinstallprompt event separately.
export default function PwaRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);
  return null;
}
