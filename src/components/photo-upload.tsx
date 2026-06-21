"use client";

import { useSyncExternalStore } from "react";

const COARSE_POINTER = "(pointer: coarse)";

function subscribeToPointer(callback: () => void) {
  if (typeof window === "undefined" || !window.matchMedia) return () => {};
  const mql = window.matchMedia(COARSE_POINTER);
  mql.addEventListener("change", callback);
  return () => mql.removeEventListener("change", callback);
}

// True on touch devices (phones/tablets), regardless of screen size.
function getIsTouch() {
  return window.matchMedia?.(COARSE_POINTER).matches ?? false;
}

// Default to the touch layout during SSR (mobile-first) so phones don't flash.
function getIsTouchServer() {
  return true;
}

const LABEL_CLASS =
  "flex items-center justify-center gap-2 border border-dashed border-stone rounded-md p-3 cursor-pointer hover:border-plum transition-colors";
const TEXT_CLASS =
  "font-mono text-[10px] tracking-[1.5px] uppercase text-quill font-medium";
const ICON_CLASS = "w-4 h-4 text-quill";

/**
 * Photo/document upload control that adapts to the device (not the screen size):
 * - Touch devices (phones/tablets): separate Gallery + Camera buttons, where
 *   Camera opens the device camera.
 * - Desktop (mouse): a single Upload button, since camera-capture is meaningless.
 *
 * `onChange` receives the file input change event in all cases.
 */
export function PhotoUpload({
  onChange,
}: {
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  const isTouch = useSyncExternalStore(
    subscribeToPointer,
    getIsTouch,
    getIsTouchServer,
  );

  if (!isTouch) {
    return (
      <label className={LABEL_CLASS}>
        <svg
          className={ICON_CLASS}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="17 8 12 3 7 8" />
          <line x1="12" x2="12" y1="3" y2="15" />
        </svg>
        <span className={TEXT_CLASS}>Upload</span>
        <input
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={onChange}
        />
      </label>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3">
      <label className={LABEL_CLASS}>
        <svg
          className={ICON_CLASS}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <circle cx="8.5" cy="8.5" r="1.5" />
          <path d="m21 15-5-5L5 21" />
        </svg>
        <span className={TEXT_CLASS}>Gallery</span>
        <input
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={onChange}
        />
      </label>
      <label className={LABEL_CLASS}>
        <svg
          className={ICON_CLASS}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
          <circle cx="12" cy="13" r="3" />
        </svg>
        <span className={TEXT_CLASS}>Camera</span>
        <input
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={onChange}
        />
      </label>
    </div>
  );
}
