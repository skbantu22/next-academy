"use client";

import { useSyncExternalStore } from "react";

// Tiny shared toggle so a full-height view (the Chat workspace, whose
// message composer sits flush in the bottom-right corner) can ask the
// globally-mounted floating AI assistant to step aside while it's on
// screen — otherwise the round FAB overlaps the composer's send button.
// Ref-counted so nested/repeat mounts can't leave the FAB hidden.
let hideCount = 0;
const listeners = new Set();

function emit() {
  listeners.forEach((listener) => listener());
}

export function hideFloatingAssistant() {
  hideCount += 1;
  emit();
  return () => {
    hideCount = Math.max(0, hideCount - 1);
    emit();
  };
}

export function useFloatingAssistantHidden() {
  return useSyncExternalStore(
    (callback) => {
      listeners.add(callback);
      return () => listeners.delete(callback);
    },
    () => hideCount > 0,
    () => false,
  );
}
