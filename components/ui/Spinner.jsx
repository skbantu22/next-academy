"use client";

import { Loader2 } from "lucide-react";

// A small, content-scoped loading indicator — NOT a full-screen/full-page
// loader. It renders inline wherever it's placed (inside a tab's content
// area, a card, a panel), so it never covers or replaces the dashboard
// shell/sidebar around it. Reuses the same lucide-react `animate-spin`
// convention already established in DirectorOverview.jsx's refresh button,
// just generalized into a reusable component.
//
// This is deliberately NOT wired into every existing "Loading..." text
// state in the app — most of those (Training, Events, Users, Shop, etc.)
// already render as plain centered text scoped to their own content area,
// which is already a good, consistent, sidebar-preserving pattern; forcing
// them all onto this component would be exactly the "blindly apply global
// changes" this was built to avoid. Use it for a NEW loading state, or
// when a component's own loading state should show more than plain text.
//
// IMPORTANT: the Dashboard's own initial-load splash
// (components/dashboard/LoadingScreen.jsx, shown once while auth/profile
// resolves before the shell mounts) is a separate, protected component —
// this file does not replace it and is never used in its place.
export default function Spinner({ label, size = "md", className = "" }) {
  const iconSize = size === "sm" ? "h-4 w-4" : size === "lg" ? "h-8 w-8" : "h-6 w-6";
  return (
    <div className={`flex flex-col items-center justify-center gap-2 py-10 text-sm text-muted ${className}`} role="status" aria-live="polite">
      <Loader2 className={`${iconSize} animate-spin text-primary`} aria-hidden="true" />
      {label && <span>{label}</span>}
    </div>
  );
}
