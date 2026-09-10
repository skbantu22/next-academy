"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ShieldAlert, ShieldCheck, ShieldX } from "lucide-react";

// Public, signed-out certificate verification page — lives at /verify, not
// under Achievement's admin routes, since it must be reachable by anyone
// holding a printed certificate or its QR code. Reads only through the
// public app/api/verify/[certificateId] proxy (no direct Firestore access,
// no auth) — see that route for why no data beyond what's shown here is
// ever exposed. Follows the same useParams() convention as the existing
// public /promote/[slug] page rather than the params-as-prop pattern.
export default function VerifyCertificatePage() {
  const { certificateId } = useParams();
  const [state, setState] = useState({ loading: true, result: null });

  useEffect(() => {
    if (!certificateId) return undefined;
    let cancelled = false;
    fetch(`/api/verify/${encodeURIComponent(certificateId)}`)
      .then((response) => response.json())
      .then((data) => !cancelled && setState({ loading: false, result: data }))
      .catch(() => !cancelled && setState({ loading: false, result: { result: "not_found" } }));
    return () => {
      cancelled = true;
    };
  }, [certificateId]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#fff7f7] p-6">
      <div className="w-full max-w-md rounded-3xl border border-[#f3aaaa] bg-white p-8 text-center shadow-xl">
        <p className="text-[10px] font-bold uppercase tracking-widest text-primary">Next Academy</p>
        <h1 className="mt-2 text-xl font-black text-ink">Certificate Verification</h1>
        <p className="mt-1 break-all font-mono text-xs text-subtle">{certificateId}</p>

        {state.loading && <p className="mt-8 text-sm text-muted">Checking...</p>}

        {!state.loading && state.result?.result === "valid" && (
          <div className="mt-8 space-y-3 text-left">
            <div className="flex items-center gap-2 text-success">
              <ShieldCheck className="h-6 w-6" aria-hidden="true" />
              <b>Valid Certificate</b>
            </div>
            <Row label="Student" value={state.result.studentName} />
            <Row label="Course" value={state.result.courseName} />
            <Row label="Issue Date" value={state.result.issueDate} />
            <Row label="Certificate ID" value={state.result.certificateId} />
            <Row label="Type" value={state.result.certificateType} />
          </div>
        )}

        {!state.loading && state.result?.result === "revoked" && (
          <div className="mt-8 space-y-3 text-left">
            <div className="flex items-center gap-2 text-primary">
              <ShieldAlert className="h-6 w-6" aria-hidden="true" />
              <b>This certificate has been revoked</b>
            </div>
            <p className="text-sm text-muted">This certificate is no longer valid and should not be relied upon.</p>
            <Row label="Certificate ID" value={state.result.certificateId} />
          </div>
        )}

        {!state.loading && (!state.result || state.result.result === "not_found") && (
          <div className="mt-8 space-y-3 text-left">
            <div className="flex items-center gap-2 text-primary">
              <ShieldX className="h-6 w-6" aria-hidden="true" />
              <b>No certificate found</b>
            </div>
            <p className="text-sm text-muted">No certificate matches this ID. Double-check the Certificate ID and try again.</p>
          </div>
        )}
      </div>
    </main>
  );
}

function Row({ label, value }) {
  if (!value) return null;
  return (
    <p className="text-sm text-ink">
      <span className="font-bold text-muted">{label}: </span>
      {value}
    </p>
  );
}
