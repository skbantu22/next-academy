"use client";

import { useEffect, useState } from "react";
import { Award, Contact, Download, Moon, Sun } from "lucide-react";
import { useAuth } from "../../lib/auth-context";
import { subscribeMyCertificates, updateMyProfile } from "../../lib/profile-data";
import IdCardPrint from "../teacher/IdCardPrint";
import EditProfileModal from "./EditProfileModal";

function DisplayField({ label, value }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-wider text-subtle">{label}</p>
      <p className={value ? "text-sm text-ink" : "text-sm italic text-subtle"}>{value || "Not set"}</p>
    </div>
  );
}

function Section({ icon, title, children }) {
  return (
    <div className="border-b border-border-subtle py-5 last:border-0">
      <p className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-subtle">
        <span aria-hidden="true">{icon}</span>
        {title}
      </p>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </div>
  );
}

function initialsFrom(name) {
  return (name || "?").trim().slice(0, 2).toUpperCase();
}

export default function SettingsPage() {
  const { user, profile } = useAuth();
  const [editing, setEditing] = useState(false);
  const [showIdCard, setShowIdCard] = useState(false);
  const [certificates, setCertificates] = useState([]);
  const [dark, setDark] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      return window.localStorage.getItem("settings-theme") === "dark";
    } catch {
      return false;
    }
  });
  const [installPrompt, setInstallPrompt] = useState(null);
  const [notifSaving, setNotifSaving] = useState(false);

  const name = profile?.displayName || user?.displayName || user?.email?.split("@")[0] || "Member";
  // Defense-in-depth only — a pending/rejected Student can't actually reach
  // Settings at all, since app/dashboard/[role]/page.jsx's central gate
  // blocks the whole dashboard first. This just keeps this page honest if
  // it's ever reached some other way.
  const isBlocked = profile?.status === "pending" || profile?.status === "rejected";
  const notificationsEnabled = profile?.notificationsEnabled !== false;
  const interests = Array.isArray(profile?.interests) ? profile.interests : [];

  useEffect(() => {
    if (!user?.uid) return undefined;
    return subscribeMyCertificates(user.uid, setCertificates, () => {});
  }, [user?.uid]);

  useEffect(() => {
    function handler(event) {
      event.preventDefault();
      setInstallPrompt(event);
    }
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  function toggleTheme() {
    const next = !dark;
    setDark(next);
    try {
      localStorage.setItem("settings-theme", next ? "dark" : "light");
    } catch {
      // ignore
    }
  }

  async function toggleNotifications() {
    if (!user?.uid || notifSaving) return;
    setNotifSaving(true);
    try {
      await updateMyProfile(user.uid, { notificationsEnabled: !notificationsEnabled });
    } finally {
      setNotifSaving(false);
    }
  }

  async function handleInstall() {
    if (!installPrompt) return;
    installPrompt.prompt();
    await installPrompt.userChoice;
    setInstallPrompt(null);
  }

  return (
    <div
      className={`${dark ? "settings-dark" : ""} space-y-6 rounded-3xl p-1`}
      style={{ backgroundColor: "var(--settings-page, transparent)" }}
    >
      <h2 className="px-1 text-2xl font-bold text-[var(--settings-ink,var(--dash-ink))]">Settings</h2>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        {/* LEFT COLUMN */}
        <div className="space-y-6">
          <div className="rounded-2xl border border-[var(--settings-border,var(--dash-border))] bg-[var(--settings-card,#ffffff)] p-6 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-4">
                {profile?.photoURL ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={profile.photoURL} alt={name} className="h-16 w-16 rounded-full object-cover" />
                ) : (
                  <span className="grid h-16 w-16 place-items-center rounded-full bg-primary text-lg font-bold text-white">
                    {initialsFrom(name)}
                  </span>
                )}
                <div>
                  <b className="block text-lg text-[var(--settings-ink,var(--dash-ink))]">{name}</b>
                  <span className="block text-xs text-[var(--settings-muted,var(--dash-muted))]">{user?.email}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="shrink-0 rounded-xl border border-[var(--settings-border,var(--dash-border))] px-4 py-2 text-xs font-bold text-[var(--settings-ink,var(--dash-ink))] hover:bg-active"
              >
                Edit profile
              </button>
            </div>

            <Section icon="👤" title="Personal details">
              <DisplayField label="Full name" value={profile?.displayName} />
              <DisplayField label="Phone number" value={profile?.phone} />
              <DisplayField label="Date of birth" value={profile?.dateOfBirth} />
              <DisplayField label="Gender" value={profile?.gender} />
              <div className="sm:col-span-2">
                <DisplayField label="Home address" value={profile?.address} />
              </div>
            </Section>

            <Section icon="🌐" title="Background">
              <DisplayField label="Race / Ethnicity" value={profile?.raceEthnicity} />
              <DisplayField label="Nationality / Citizenship" value={profile?.nationality} />
              <DisplayField label="Religion" value={profile?.religion} />
              <DisplayField label="Blood group" value={profile?.bloodGroup} />
            </Section>

            <Section icon="📇" title="Emergency contact">
              <DisplayField label="Contact name" value={profile?.emergencyContactName} />
              <DisplayField label="Contact number" value={profile?.emergencyContactPhone} />
            </Section>

            <Section icon="✨" title="About you">
              <div className="sm:col-span-2">
                <DisplayField label="About me" value={profile?.about} />
              </div>
              <div className="sm:col-span-2">
                <DisplayField label="Interests" value={interests.length ? interests.join(", ") : ""} />
              </div>
            </Section>

            <div className="mt-2 flex flex-wrap items-center justify-between gap-4">
              <span className="rounded-full bg-active px-3 py-1 text-xs font-semibold text-primary">
                Your role: {profile?.role || "—"}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="mt-4 w-full rounded-xl bg-primary py-3 text-sm font-bold text-white hover:bg-primary-hover"
            >
              Edit profile
            </button>
          </div>
        </div>

        {/* RIGHT COLUMN */}
        <div className="space-y-6">
          <div className="rounded-2xl border border-[var(--settings-border,var(--dash-border))] bg-[var(--settings-card,#ffffff)] p-6 shadow-sm">
            <b className="flex items-center gap-2 text-sm text-[var(--settings-ink,var(--dash-ink))]">
              <Award className="h-4 w-4 text-primary" aria-hidden="true" />
              My Certificates
            </b>
            {certificates.length ? (
              <div className="mt-3 space-y-2">
                {certificates.map((cert) => (
                  <div key={cert.id} className="rounded-xl border border-[var(--settings-border,var(--dash-border))] p-3 text-xs">
                    <b className="block text-[var(--settings-ink,var(--dash-ink))]">{cert.title || "Certificate"}</b>
                    <span className="text-[var(--settings-muted,var(--dash-muted))]">{cert.status || "Issued"}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-xs text-[var(--settings-muted,var(--dash-muted))]">
                No certificates yet. Complete events or trainings to earn certificates.
              </p>
            )}
          </div>

          {isBlocked ? (
            <div className="rounded-2xl border border-border-subtle bg-page p-5">
              <b className="block text-sm text-ink">ID Card</b>
              <p className="mt-1 text-xs text-muted">
                🔒 ID Card unavailable — your ID Card will become available after your account is approved.
              </p>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowIdCard(true)}
              className="flex w-full items-center gap-3 rounded-2xl border border-red-line bg-active p-5 text-left shadow-sm transition hover:-translate-y-0.5"
            >
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white text-primary">
                <Contact className="h-5 w-5" aria-hidden="true" />
              </span>
              <span>
                <b className="block text-sm text-primary">View your ID Card</b>
                <span className="text-xs text-muted">Open your digital member card and check-in QR for events.</span>
              </span>
            </button>
          )}

          <div className="rounded-2xl border border-[var(--settings-border,var(--dash-border))] bg-[var(--settings-card,#ffffff)] p-6 shadow-sm">
            <b className="text-sm text-[var(--settings-ink,var(--dash-ink))]">App Settings</b>

            <div className="mt-4 flex items-center justify-between gap-4 border-b border-[var(--settings-border,var(--dash-border))] pb-4">
              <div>
                <p className="text-xs font-semibold text-[var(--settings-ink,var(--dash-ink))]">Theme</p>
                <p className="text-[10px] text-[var(--settings-muted,var(--dash-muted))]">Switch between light and dark mode</p>
              </div>
              <button
                type="button"
                onClick={toggleTheme}
                className="flex items-center gap-1.5 rounded-lg border border-[var(--settings-border,var(--dash-border))] px-3 py-1.5 text-xs font-bold text-[var(--settings-ink,var(--dash-ink))]"
              >
                {dark ? <Moon className="h-3.5 w-3.5" /> : <Sun className="h-3.5 w-3.5" />}
                {dark ? "Dark" : "Light"}
              </button>
            </div>

            <div className="mt-4 flex items-center justify-between gap-4 border-b border-[var(--settings-border,var(--dash-border))] pb-4">
              <div>
                <p className="text-xs font-semibold text-[var(--settings-ink,var(--dash-ink))]">Notifications</p>
                <p className="text-[10px] text-[var(--settings-muted,var(--dash-muted))]">
                  Show unread badges for your notifications
                </p>
              </div>
              <button
                type="button"
                onClick={toggleNotifications}
                disabled={notifSaving}
                className={`rounded-lg border px-3 py-1.5 text-xs font-bold disabled:opacity-60 ${notificationsEnabled ? "border-info bg-info-soft text-info" : "border-[var(--settings-border,var(--dash-border))] text-[var(--settings-muted,var(--dash-muted))]"}`}
              >
                {notificationsEnabled ? "Enabled" : "Disabled"}
              </button>
            </div>

            <div className="mt-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold text-[var(--settings-ink,var(--dash-ink))]">Install App</p>
                  <p className="text-[10px] text-[var(--settings-muted,var(--dash-muted))]">Install Next Academy as a standalone app</p>
                </div>
                <button
                  type="button"
                  onClick={handleInstall}
                  disabled={!installPrompt}
                  className="flex items-center gap-1.5 rounded-lg bg-success px-3 py-1.5 text-xs font-bold text-white disabled:opacity-40"
                >
                  <Download className="h-3.5 w-3.5" />
                  Install
                </button>
              </div>
              {!installPrompt && (
                <p className="mt-2 rounded-lg bg-page p-2 text-[10px] text-[var(--settings-muted,var(--dash-muted))]">
                  Use your browser&apos;s menu → &quot;Install app&quot; or &quot;Add to Home Screen&quot;
                </p>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-[var(--settings-border,var(--dash-border))] bg-[var(--settings-card,#ffffff)] p-6 shadow-sm">
            <b className="text-sm text-[var(--settings-ink,var(--dash-ink))]">Account</b>
            <div className="mt-3 space-y-3">
              <DisplayField label="Email" value={user?.email} />
              <DisplayField label="Title" value={profile?.role} />
              <DisplayField label="Member ID" value={profile?.userId} />
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-subtle">Account Status</p>
                {profile?.status === "pending" ? (
                  <span className="mt-1 inline-block rounded-full bg-warning-soft px-2.5 py-1 text-[10px] font-bold text-warning">
                    🟠 Pending Approval
                  </span>
                ) : profile?.status === "rejected" ? (
                  <span className="mt-1 inline-block rounded-full bg-active px-2.5 py-1 text-[10px] font-bold text-primary">
                    🔴 Registration Rejected
                  </span>
                ) : (
                  <span
                    className={`mt-1 inline-block rounded-full px-2.5 py-1 text-[10px] font-bold ${profile?.active === false ? "bg-active text-primary" : "bg-success-soft text-success"}`}
                  >
                    {profile?.active === false ? "inactive" : "🟢 active"}
                  </span>
                )}
                {isBlocked && <p className="mt-1.5 text-[10px] text-muted">Account is not active yet.</p>}
              </div>
            </div>
          </div>
        </div>
      </div>

      {editing && (
        <EditProfileModal uid={user?.uid} profile={profile} onClose={() => setEditing(false)} onSaved={() => {}} />
      )}

      {showIdCard && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <b className="text-sm text-ink">Your ID Card</b>
              <button type="button" onClick={() => setShowIdCard(false)} className="text-xs font-bold text-primary">
                Close
              </button>
            </div>
            <IdCardPrint
              mode="self"
              roleLabel={profile?.role || "Member"}
              fallbackName={name}
              fallbackEmail={user?.email}
              photoURL={profile?.photoURL}
              active={profile?.active}
              status={profile?.status}
            />
          </div>
        </div>
      )}
    </div>
  );
}
