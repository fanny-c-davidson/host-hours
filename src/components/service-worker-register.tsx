"use client";

import { useEffect } from "react";

// Registers the service worker (installability + offline). Renders nothing.
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;

    // In dev, the SW's cache-first build-asset handling would serve stale HMR
    // chunks — so don't register it, and clear any leftover registration.
    if (process.env.NODE_ENV !== "production") {
      navigator.serviceWorker
        .getRegistrations()
        .then((regs) => regs.forEach((r) => r.unregister()))
        .catch(() => {});
      return;
    }

    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Registration is best-effort — failure just means no PWA install.
    });
  }, []);
  return null;
}
