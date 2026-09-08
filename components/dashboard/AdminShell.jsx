"use client";

import { useState } from "react";
import Link from "next/link";
import SidebarIcon from "./SidebarIcon";
import ChatButton, { useUnreadConversationCount } from "./ChatButton";
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

// Extracted verbatim from the Admin/generic dashboard shell (previously
// inline in DashboardContent, app/dashboard/[role]/page.jsx) so any Admin
// route — the dashboard itself, or a separate route like Training Details —
// renders the exact same sidebar/header instead of duplicating or omitting it.
export default function AdminShell({
  role,
  modules,
  active,
  getHref,
  onNavigate,
  name,
  initials,
  userEmail,
  headerTitle,
  onLogout,
  children,
}) {
  const [mobileOpen, setMobileOpen] = useState(false);

  function go(module) {
    onNavigate?.(module);
    setMobileOpen(false);
  }

  const chatHref = getHref?.("Chat");
  const unreadChat = useUnreadConversationCount();

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
        <nav className="custom-scrollbar flex-1 overflow-y-auto px-4 py-5">
          {modules.map((module) => {
            const isActive = active === module;
            const className = `mb-2 flex min-h-12 w-full items-center gap-4 rounded-xl px-4 py-3 text-left text-[15px] font-semibold transition ${isActive ? "border border-red-line bg-active text-ink" : "text-muted hover:bg-page hover:text-ink"}`;
            const content = (
              <>
                <span className={`grid h-6 w-6 shrink-0 place-items-center ${isActive ? "text-primary" : ""}`}>
                  <SidebarIcon name={module} className="h-6 w-6" />
                </span>
                {module}
                {module === "Chat" && unreadChat > 0 && (
                  <b className="ml-auto rounded-full bg-primary px-1.5 py-0.5 text-[9px] text-white">
                    {unreadChat > 9 ? "9+" : unreadChat}
                  </b>
                )}
              </>
            );
            const href = getHref?.(module);
            return href ? (
              <Link key={module} href={href} onClick={() => go(module)} className={className}>
                {content}
              </Link>
            ) : (
              <button key={module} onClick={() => go(module)} className={className}>
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

      <section className="flex min-h-screen min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-border-subtle bg-white px-4 shadow-sm md:px-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setMobileOpen(true)}
              className="text-xl text-muted md:hidden"
              aria-label="Open menu"
            >
              ☰
            </button>
            <h1 className="text-lg font-bold text-ink md:text-xl">{headerTitle}</h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative hidden sm:block">
              <input
                className="w-52 rounded-xl border border-border-subtle bg-page px-4 py-2 pl-9 text-xs outline-none focus:ring-2 focus:ring-primary"
                placeholder="Search records, students..."
              />
              <span className="absolute left-3 top-2.5 text-subtle">⌕</span>
            </div>
            <ChatButton href={chatHref} onClick={() => go("Chat")} />
            <button
              onClick={() => go("Settings")}
              className="flex items-center gap-2 rounded-full border border-border-subtle bg-white py-1 pl-1 pr-3 hover:bg-page"
              aria-label="Open settings"
              title={userEmail}
            >
              <span className="grid h-8 w-8 place-items-center rounded-full border-2 border-primary bg-active text-xs font-bold text-primary">
                {initials}
              </span>
              <span className="hidden text-left sm:block">
                <b className="block text-xs text-ink">{name}</b>
              </span>
            </button>
            <button
              onClick={onLogout}
              className="rounded-full border border-border-subtle bg-white px-4 py-2 text-xs font-bold text-ink hover:bg-page"
            >
              Sign out
            </button>
            <NotificationBell />
          </div>
        </header>
        <div className="flex-1 px-4 py-4 md:py-6 lg:py-8">
          <div className="space-y-6">{children}</div>
        </div>
      </section>
    </main>
  );
}
