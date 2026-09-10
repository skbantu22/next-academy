"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { issueQrToken } from "../../lib/services/qr-service";

// The Digital Membership / D Card. Every value here is real: `userId`
// comes from the authenticated subject's own Firestore doc (see
// app/api/teacher/qr-token/route.js, which backfills it via
// lib/server/user-id.js's ensureUserId if a legacy account predates the
// field) and the QR is a server-signed, versioned token (lib/qr-token.js)
// — never a raw ID rendered client-side, never regenerated with a
// different identity on every refresh. There is deliberately no
// "Volunteer ID"/VID anywhere: the unified User ID is the only ID this
// card (or any part of the app) shows, for every role.
export default function IdCardPrint({
  mode,
  studentId,
  fallbackName,
  fallbackEmail,
  roleLabel,
  organization = "Next Academy",
  photoURL,
  active,
  status,
}) {
  const [state, setState] = useState({ loading: true, error: "", token: null, subject: null });
  const [qrImage, setQrImage] = useState("");
  const [regenerating, setRegenerating] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const body = mode === "student" ? { mode, studentId, regenerate: false } : { mode: "self", regenerate: false };
    issueQrToken(body)
      .then((result) => {
        if (!cancelled)
          setState({ loading: false, error: "", token: result.token, subject: result.subject });
      })
      .catch((error) => {
        if (!cancelled)
          setState({ loading: false, error: error.message, token: null, subject: null });
      });
    return () => {
      cancelled = true;
    };
  }, [mode, studentId]);

  useEffect(() => {
    if (!state.token) return undefined;
    let cancelled = false;
    QRCode.toDataURL(state.token, { margin: 1, width: 220 }).then((url) => {
      if (!cancelled) setQrImage(url);
    });
    return () => {
      cancelled = true;
    };
  }, [state.token]);

  async function regenerate() {
    setRegenerating(true);
    setState((current) => ({ ...current, loading: true, error: "" }));
    try {
      const body = mode === "student" ? { mode, studentId, regenerate: true } : { mode: "self", regenerate: true };
      const result = await issueQrToken(body);
      setState({ loading: false, error: "", token: result.token, subject: result.subject });
    } catch (error) {
      setState({ loading: false, error: error.message, token: null, subject: null });
    } finally {
      setRegenerating(false);
    }
  }

  if (state.loading) {
    return <div className="rounded-2xl border border-dashed border-border-subtle p-8 text-center text-sm text-muted">Preparing your D Card...</div>;
  }
  if (state.error) {
    return <div className="rounded-2xl border border-dashed border-red-line p-8 text-center text-sm text-primary">{state.error}</div>;
  }

  const name = state.subject?.displayName || fallbackName || "Unnamed";
  const email = state.subject?.email || fallbackEmail || "";
  const userId = state.subject?.userId || "—";
  // The server-returned subject (the real target account — the student
  // being viewed in "student" mode, or the caller themselves in "self"
  // mode) always wins over the caller-supplied fallback props, so a
  // Teacher viewing a student's card sees that STUDENT's real photo/status,
  // never the teacher's own.
  const resolvedPhoto = state.subject?.photoURL || photoURL;
  const resolvedActive = state.subject ? state.subject.active !== false : active !== false;
  const resolvedStatus = state.subject?.status || status;
  const isActive = resolvedActive && resolvedStatus !== "pending" && resolvedStatus !== "rejected";
  const statusLabel = resolvedStatus === "pending" ? "Pending" : resolvedStatus === "rejected" ? "Rejected" : isActive ? "Active" : "Inactive";

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr] lg:items-start">
      <style>{`@media print { .no-print { display: none !important; } body * { visibility: hidden; } #id-card, #id-card * { visibility: visible; } #id-card { position: fixed; inset: 0; margin: auto; } }`}</style>

      <div>
        <div
          id="id-card"
          className="mx-auto w-full max-w-sm rounded-3xl border border-red-line bg-white p-6 shadow-sm"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <img src="/logo.jpeg" alt={`${organization} logo`} className="h-8 w-8 rounded-lg object-contain" />
              <div>
                <b className="block text-xs text-ink">{organization} Member</b>
                <small className="block text-[9px] font-bold uppercase tracking-widest text-primary">Digital Membership</small>
              </div>
            </div>
            <span
              className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${
                isActive ? "bg-success-soft text-success" : status === "pending" ? "bg-warning-soft text-warning" : "bg-active text-primary"
              }`}
            >
              {statusLabel}
            </span>
          </div>

          <div className="mt-4 flex items-center gap-4">
            {resolvedPhoto ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={resolvedPhoto} alt={name} className="h-16 w-16 shrink-0 rounded-full border-2 border-red-line object-cover" />
            ) : (
              <span className="grid h-16 w-16 shrink-0 place-items-center rounded-full border-2 border-red-line bg-page text-xl font-bold text-subtle">
                {name?.[0]?.toUpperCase() || "?"}
              </span>
            )}
            <div className="min-w-0">
              <b className="block truncate text-base text-ink">{name}</b>
              <span className="block truncate text-sm font-semibold text-primary">{roleLabel}</span>
              <span className="mt-1 inline-block rounded-full bg-page px-2 py-0.5 font-mono text-[10px] font-bold text-muted">
                SID · {userId}
              </span>
            </div>
          </div>

          <div className="my-4 border-t border-dashed border-border-subtle" />

          <p className="text-center text-[10px] font-bold uppercase tracking-widest text-subtle">Check-in QR</p>
          <div className="mt-2 grid place-items-center rounded-2xl bg-page p-4">
            {qrImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={qrImage} alt="Attendance check-in QR code" className="h-40 w-40" />
            ) : (
              <span className="text-xs text-subtle">Generating QR...</span>
            )}
          </div>
          <p className="mt-3 text-center text-[11px] text-muted">
            Show this code at check-in. Scan once to start, again when you leave.
          </p>

          <div className="mt-4 flex items-center justify-between border-t border-border-subtle pt-3 text-[10px] text-subtle">
            <span className="truncate">{email}</span>
          </div>
        </div>

        <div className="no-print mx-auto mt-4 flex max-w-sm gap-3">
          <button
            onClick={() => window.print()}
            className="flex-1 rounded-xl bg-primary px-4 py-2.5 text-xs font-bold text-white"
          >
            Print D Card
          </button>
          <button
            onClick={regenerate}
            disabled={regenerating}
            className="flex-1 rounded-xl border border-border-subtle px-4 py-2.5 text-xs font-bold text-muted disabled:opacity-40"
          >
            {regenerating ? "Regenerating..." : "Regenerate QR"}
          </button>
        </div>
      </div>

      <div className="no-print rounded-2xl border border-border-subtle bg-white p-6 shadow-sm">
        <b className="text-sm text-ink">How to use</b>
        <ul className="mt-3 space-y-2 text-xs leading-5 text-muted">
          <li>Open this page before you reach the check-in desk.</li>
          <li>Turn screen brightness up so the QR scans easily.</li>
          <li>First scan checks you in; scan again when you leave to record your session.</li>
          <li>The scanner will show your name — make sure it matches you.</li>
          <li>Your QR is tied to your account; do not share screenshots.</li>
        </ul>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-page p-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-subtle">Role</p>
            <p className="mt-1 text-sm font-semibold text-ink">{roleLabel}</p>
          </div>
          <div className="rounded-xl bg-page p-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-subtle">Student ID</p>
            <p className="mt-1 font-mono text-sm font-semibold text-ink">{userId}</p>
          </div>
          <div className="col-span-2 rounded-xl bg-page p-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-subtle">Account</p>
            <p className="mt-1 text-sm font-semibold text-ink">{statusLabel}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
