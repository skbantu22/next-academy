"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { issueQrToken } from "../../lib/services/qr-service";

export default function IdCardPrint({
  mode,
  studentId,
  fallbackName,
  fallbackEmail,
  roleLabel,
  organization = "Next Academy",
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
    return <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">Preparing ID card...</div>;
  }
  if (state.error) {
    return <div className="rounded-2xl border border-dashed border-red-300 p-8 text-center text-sm text-red-600">{state.error}</div>;
  }

  const name = state.subject?.displayName || fallbackName || "Unnamed";
  const email = state.subject?.email || fallbackEmail || "";

  return (
    <div className="grid gap-4">
      <style>{`@media print { .no-print { display: none !important; } body * { visibility: hidden; } #id-card, #id-card * { visibility: visible; } #id-card { position: fixed; inset: 0; margin: auto; } }`}</style>
      <div
        id="id-card"
        className="mx-auto w-full max-w-sm rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        <div className="mb-4 flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-red-600 text-sm font-bold text-white">N</span>
          <div>
            <b className="block text-sm">{organization}</b>
            <small className="text-[10px] uppercase tracking-widest text-slate-400">{roleLabel} ID Card</small>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-2xl bg-slate-100 text-2xl font-bold text-slate-400">
            {name?.[0]?.toUpperCase() || "?"}
          </div>
          <div className="min-w-0">
            <b className="block truncate text-base">{name}</b>
            <span className="block truncate text-xs text-slate-500">{email}</span>
            <span className="mt-1 block text-[11px] font-semibold text-slate-400">
              ID: {state.subject?.id || "—"}
            </span>
          </div>
        </div>
        <div className="mt-5 grid place-items-center rounded-2xl bg-slate-50 p-4">
          {qrImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qrImage} alt="Attendance QR code" className="h-40 w-40" />
          ) : (
            <span className="text-xs text-slate-400">Generating QR...</span>
          )}
        </div>
      </div>
      <div className="no-print mx-auto flex gap-3">
        <button
          onClick={() => window.print()}
          className="rounded-xl bg-red-600 px-4 py-2 text-xs font-bold text-white"
        >
          Print
        </button>
        <button
          onClick={regenerate}
          disabled={regenerating}
          className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 disabled:opacity-40"
        >
          {regenerating ? "Regenerating..." : "Regenerate QR"}
        </button>
      </div>
    </div>
  );
}
