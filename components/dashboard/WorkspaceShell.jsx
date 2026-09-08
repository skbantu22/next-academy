"use client";

import { useState } from "react";
import Link from "next/link";
import SidebarIcon from "./SidebarIcon";

function Brand() {
  return (
    <div className="flex items-center gap-3">
      <img
        src="/logo.jpeg"
        alt="Next Academy logo"
        className="h-10 w-10 rounded-xl object-contain shadow-lg shadow-red-950/30"
      />
      <div>
        <p className="text-sm font-bold leading-tight text-white">
          Next Academy
        </p>
        <p className="text-[9px] font-semibold uppercase tracking-[.18em] text-red-300">
          Learning platform
        </p>
      </div>
    </div>
  );
}

// Extracted from the Director dashboard shell (app/dashboard/[role]/page.jsx)
// so every workspace shares the exact same sidebar/header chrome. Keep this
// component's markup/classes in lockstep with Director's — this IS Director's
// shell, just parameterized by role.
export default function WorkspaceShell({
  roleLabel,
  modules,
  active,
  getHref,
  onNavigate,
  renderBadge,
  name,
  initials,
  footerName,
  footerEmail,
  profileRoleLabel,
  profileDescription,
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
    <main className="min-h-screen bg-slate-100 text-slate-800 md:flex">
      <aside
        className={`${mobileOpen ? "translate-x-0" : "-translate-x-full"} fixed inset-y-0 left-0 z-40 flex h-screen w-[280px] flex-col bg-slate-950 text-slate-300 shadow-2xl transition-transform duration-300 md:sticky md:top-0 md:translate-x-0 md:shadow-none`}
      >
        <div className="flex items-center justify-between border-b border-slate-800 p-5">
          <Brand />
          <button
            onClick={() => setMobileOpen(false)}
            className="text-xl text-slate-400 md:hidden"
            aria-label="Close menu"
          >
            ×
          </button>
        </div>
        <div className="border-b border-slate-800 px-5 py-4">
          <span className="rounded bg-red-500/15 px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-red-300">
            {roleLabel}
          </span>
        </div>
        <nav className="flex-1 overflow-y-auto px-4 py-5">
          {modules.map((module) => {
            const className = `mb-2 flex min-h-12 w-full items-center gap-4 rounded-xl px-4 py-3 text-left text-[15px] font-semibold transition ${active === module ? "bg-red-600 text-white shadow-lg shadow-red-950/30" : "text-slate-400 hover:bg-slate-800 hover:text-white"}`;
            const content = (
              <>
                <span className="grid h-6 w-6 shrink-0 place-items-center">
                  <SidebarIcon name={module} className="h-6 w-6" />
                </span>
                {module}
                {renderBadge?.(module)}
              </>
            );
            const href = getHref?.(module);
            return href ? (
              <Link
                key={module}
                href={href}
                onClick={() => handleNavClick(module)}
                className={className}
              >
                {content}
              </Link>
            ) : (
              <button
                key={module}
                onClick={() => handleNavClick(module)}
                className={className}
              >
                {content}
              </button>
            );
          })}
        </nav>
        <div className="border-t border-slate-800 bg-slate-950/60 p-4">
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-full bg-red-700 text-sm font-bold text-white">
              {initials}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-white">{footerName}</p>
              <p className="truncate text-xs text-slate-400">{footerEmail}</p>
            </div>
          </div>
          <button
            onClick={onLogout}
            className="mt-4 w-full rounded-lg bg-slate-800 px-3 py-2.5 text-xs font-semibold text-slate-300 hover:text-red-300"
          >
            Sign Out Session
          </button>
        </div>
      </aside>
      {mobileOpen && (
        <button
          className="fixed inset-0 z-30 bg-slate-950/60 md:hidden"
          onClick={() => setMobileOpen(false)}
          aria-label="Close navigation"
        />
      )}
      <section className="min-w-0 flex-1">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-slate-200 bg-white px-4 shadow-sm md:px-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileOpen(true)}
              className="text-xl text-slate-600 md:hidden"
              aria-label="Open menu"
            >
              ☰
            </button>
            <div>
              <h1 className="text-lg font-bold text-slate-800">{headerTitle}</h1>
              <p className="hidden text-[10px] uppercase tracking-wider text-slate-400 sm:block">
                {headerSubtitle}
              </p>
            </div>
          </div>
          <div className="relative">
            <button
              onClick={() => setProfileOpen(!profileOpen)}
              className="flex items-center gap-2 border-l border-slate-200 pl-3"
            >
              <span className="grid h-9 w-9 place-items-center rounded-full bg-red-600 text-xs font-bold text-white">
                {initials}
              </span>
              <span className="hidden text-left sm:block">
                <b className="block text-xs text-slate-800">{name}</b>
                <small className="text-[10px] text-slate-500">{profileRoleLabel}</small>
              </span>
              <span className="text-slate-400">⌄</span>
            </button>
            {profileOpen && (
              <div className="absolute right-0 top-12 z-30 w-52 rounded-2xl border border-slate-200 bg-white p-3 shadow-2xl">
                <p className="border-b border-slate-100 pb-3 text-xs font-semibold">
                  {userEmail}
                </p>
                <p className="py-3 text-xs text-slate-500">{profileDescription}</p>
                <button
                  onClick={onLogout}
                  className="w-full rounded-lg bg-red-50 px-3 py-2 text-left text-xs font-bold text-red-700"
                >
                  Sign Out Session
                </button>
              </div>
            )}
          </div>
        </header>
        <div className="p-4 md:p-6 lg:p-8">
          <div className="mx-auto max-w-7xl space-y-6">{children}</div>
        </div>
      </section>
    </main>
  );
}
