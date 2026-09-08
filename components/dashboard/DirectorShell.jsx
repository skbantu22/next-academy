"use client";

import { useState } from "react";
import Link from "next/link";
import SidebarIcon from "./SidebarIcon";
import ChatButton from "./ChatButton";
import NotificationBell from "./NotificationBell";

function Brand() {
  return (
    <div className="flex items-center gap-3">
      <img
        src="/logo.jpeg"
        alt="Next Academy logo"
        className="h-10 w-10 rounded-xl object-contain shadow-sm"
      />
      <div>
        <p className="text-sm font-bold leading-tight text-ink">
          Next Academy
        </p>
        <p className="text-[9px] font-semibold uppercase tracking-[.18em] text-primary">
          Learning platform
        </p>
      </div>
    </div>
  );
}

// Extracted verbatim from Director's dashboard shell (previously inline in
// app/dashboard/[role]/page.jsx) so any Director route — the dashboard
// itself, or a separate route like Training Details — renders the exact
// same sidebar/header instead of duplicating or omitting it.
export default function DirectorShell({
  modules,
  active,
  getHref,
  onNavigate,
  name,
  initials,
  userEmail,
  headerTitle,
  headerSubtitle,
  onLogout,
  children,
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  function handleNavClick(module) {
    onNavigate?.(module);
    setMobileOpen(false);
  }

  return (
    <main className="min-h-screen bg-page text-ink md:flex">
      <aside
        className={`${mobileOpen ? "translate-x-0" : "-translate-x-full"} fixed inset-y-0 left-0 z-40 flex h-screen w-[280px] flex-col border-r border-border-subtle bg-white shadow-2xl transition-transform duration-300 md:sticky md:top-0 md:translate-x-0 md:shadow-none`}
      >
        <div className="flex items-center justify-between border-b border-border-subtle p-5">
          <Brand />
          <button
            onClick={() => setMobileOpen(false)}
            className="text-xl text-subtle md:hidden"
            aria-label="Close menu"
          >
            ×
          </button>
        </div>
        <nav className="flex-1 overflow-y-auto px-4 py-5">
          {modules.map((module) => {
            const isActive = active === module;
            const className = `mb-2 flex min-h-12 w-full items-center gap-4 rounded-xl px-4 py-3 text-left text-[15px] font-semibold transition ${isActive ? "border border-red-line bg-active text-ink" : "text-muted hover:bg-page hover:text-ink"}`;
            const content = (
              <>
                <span className={`grid h-6 w-6 shrink-0 place-items-center ${isActive ? "text-primary" : ""}`}>
                  <SidebarIcon name={module} className="h-6 w-6" />
                </span>
                {module}
              </>
            );
            const href = getHref?.(module);
            return href ? (
              <Link key={module} href={href} onClick={() => handleNavClick(module)} className={className}>
                {content}
              </Link>
            ) : (
              <button key={module} onClick={() => handleNavClick(module)} className={className}>
                {content}
              </button>
            );
          })}
        </nav>
      </aside>
      {mobileOpen && (
        <button
          className="fixed inset-0 z-30 bg-slate-950/60 md:hidden"
          onClick={() => setMobileOpen(false)}
          aria-label="Close navigation"
        />
      )}
      <section className="min-w-0 flex-1">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-border-subtle bg-white px-4 shadow-sm md:px-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileOpen(true)}
              className="text-xl text-muted md:hidden"
              aria-label="Open menu"
            >
              ☰
            </button>
            <div>
              <h1 className="text-lg font-bold text-ink">{headerTitle}</h1>
              <p className="hidden text-[10px] uppercase tracking-wider text-subtle sm:block">
                {headerSubtitle}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <ChatButton onClick={() => onNavigate?.("Chat")} />
            <NotificationBell />
            <div className="relative">
              <button
                onClick={() => setProfileOpen(!profileOpen)}
                className="flex items-center gap-2 border-l border-border-subtle pl-3"
              >
                <span className="grid h-9 w-9 place-items-center rounded-full bg-primary text-xs font-bold text-white">
                  {initials}
                </span>
                <span className="hidden text-left sm:block">
                  <b className="block text-xs text-ink">{name}</b>
                  <small className="text-[10px] text-muted">Director</small>
                </span>
                <span className="text-subtle">⌄</span>
              </button>
              {profileOpen && (
              <div className="absolute right-0 top-12 z-30 w-52 rounded-2xl border border-border-subtle bg-white p-3 shadow-2xl">
                <p className="border-b border-border-subtle pb-3 text-xs font-semibold">
                  {userEmail}
                </p>
                <p className="py-3 text-xs text-muted">
                  Authenticated Director profile
                </p>
                <button
                  onClick={onLogout}
                  className="w-full rounded-lg bg-active px-3 py-2 text-left text-xs font-bold text-primary"
                >
                  Sign Out Session
                </button>
              </div>
              )}
            </div>
          </div>
        </header>
        <div className="px-4 py-4 md:py-6 lg:py-8">
          <div className="space-y-6">{children}</div>
        </div>
      </section>
    </main>
  );
}
