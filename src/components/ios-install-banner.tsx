"use client";

import { useSyncExternalStore } from "react";

const DISMISS_KEY = "hh-ios-install-dismissed";
const listeners = new Set<() => void>();

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

// Show only on iOS *Safari* (the only iOS browser that can "Add to Home Screen"),
// when not already installed, and not previously dismissed.
function shouldShow(): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (localStorage.getItem(DISMISS_KEY) === "1") return false;
  } catch {
    // ignore storage errors
  }
  const ua = navigator.userAgent || "";
  const isIOS =
    /iphone|ipad|ipod/i.test(ua) ||
    // iPadOS reports as Mac; disambiguate via touch.
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  // Other iOS browsers (Chrome/Firefox/Edge/Opera) can't add to home screen.
  const isSafari = !/crios|fxios|edgios|opios/i.test(ua);
  const standalone =
    ("standalone" in navigator &&
      (navigator as Navigator & { standalone?: boolean }).standalone === true) ||
    window.matchMedia("(display-mode: standalone)").matches;
  return isIOS && isSafari && !standalone;
}

function getServerSnapshot() {
  return false;
}

function dismiss() {
  try {
    localStorage.setItem(DISMISS_KEY, "1");
  } catch {
    // ignore storage errors
  }
  for (const l of listeners) l();
}

export function IosInstallBanner() {
  const show = useSyncExternalStore(subscribe, shouldShow, getServerSnapshot);
  if (!show) return null;

  return (
    <div
      className="fixed left-1/2 -translate-x-1/2 z-[60] w-[calc(100%-1.5rem)] max-w-md"
      style={{ bottom: "calc(5.25rem + env(safe-area-inset-bottom))" }}
    >
      <div className="flex items-center gap-3 rounded-xl bg-plum text-cream shadow-lg px-4 py-3">
        <span className="shrink-0 w-9 h-9 rounded-lg bg-cream/15 flex items-center justify-center font-serif text-[15px] font-bold">
          HH
        </span>
        <p className="flex-1 text-[13px] leading-snug">
          Install Host Hours: tap{" "}
          <span aria-hidden className="inline-flex items-center align-middle mx-0.5">
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 16V4" />
              <path d="m8 8 4-4 4 4" />
              <path d="M20 14v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-6" />
            </svg>
          </span>{" "}
          then <strong className="font-semibold">Add to Home Screen</strong>.
        </p>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss"
          className="shrink-0 w-7 h-7 rounded-full bg-cream/15 flex items-center justify-center text-[15px] leading-none"
        >
          ×
        </button>
      </div>
    </div>
  );
}
