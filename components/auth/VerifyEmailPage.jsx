"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { applyActionCode } from "firebase/auth";
import { useAuth } from "../../lib/auth-context";
import { auth as firebaseAuth } from "../../lib/firebase";

function Logo() {
  return (
    <Link
      href="/"
      className="flex items-center justify-center gap-3 text-xl font-bold tracking-tight text-slate-900"
    >
      <img
        src="/logo.jpeg"
        alt="Next Academy logo"
        className="h-12 w-12 rounded-2xl object-contain shadow-xl shadow-red-600/20"
      />
      <span>Next Academy</span>
    </Link>
  );
}

function Shell({ children }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-red-950 via-slate-900 to-red-900 p-4 text-slate-800 selection:bg-red-600 selection:text-white sm:p-6">
      <div className="w-full max-w-md rounded-3xl border border-slate-700/50 bg-white/95 p-6 text-center shadow-2xl backdrop-blur-xl sm:p-8">
        <div className="mb-8">
          <Logo />
          <p className="mt-2 text-[10px] font-semibold uppercase tracking-[.18em] text-slate-500">
            Your educational & community center
          </p>
        </div>
        {children}
        <p className="mt-6 text-center text-[10px] text-slate-400">
          Secure authentication powered by Firebase.
        </p>
      </div>
    </main>
  );
}

// Standard Firebase email-verification LINK flow (replaces the old 6-digit
// OTP page). This single route serves two situations:
//
//   1. A user lands here normally right after registering, or after a
//      login attempt that found their email unverified — no `oobCode` in
//      the URL. They see "Check your email" with Resend / "I've Verified
//      My Email" / "Go back".
//   2. A user clicks the actual link Firebase emailed them. Because
//      `sendEmailVerification()` is called with
//      `actionCodeSettings.handleCodeInApp: true`, Firebase sends them
//      back here (not to its own generic hosted page) with
//      `?mode=verifyEmail&oobCode=...` — this app must finish the
//      verification itself via `applyActionCode()`.
export default function VerifyEmailPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const auth = useAuth();

  const mode = searchParams.get("mode");
  const oobCode = searchParams.get("oobCode");
  const hasActionLink = mode === "verifyEmail" && Boolean(oobCode);

  const [linkState, setLinkState] = useState(hasActionLink ? "applying" : "none"); // none | applying | applied | failed
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  // Case 2 above: complete the verification action code.
  useEffect(() => {
    if (!hasActionLink || !firebaseAuth) return undefined;
    let cancelled = false;
    applyActionCode(firebaseAuth, oobCode)
      .then(() => auth.checkEmailVerified())
      .then((verified) => {
        if (cancelled) return;
        setLinkState("applied");
        if (!verified) {
          // No matching session in *this* browser tab (e.g. verified on a
          // different device) — the link itself still succeeded.
          setMessage("Your email has been verified. Please sign in.");
        }
      })
      .catch(async (linkError) => {
        if (cancelled) return;
        // A code Firebase already consumed (e.g. this page was reloaded,
        // or the "I've Verified" button already applied it) still means
        // the account is verified — check the live status before treating
        // it as a real failure.
        const alreadyVerified = await auth.checkEmailVerified().catch(() => false);
        if (cancelled) return;
        if (alreadyVerified) {
          setLinkState("applied");
          return;
        }
        setLinkState("failed");
        setMessage(
          linkError?.code === "auth/invalid-action-code" || linkError?.code === "auth/expired-action-code"
            ? "This verification link is invalid or has already been used. Request a new one below."
            : "Unable to verify this link. Please try again.",
        );
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasActionLink, oobCode]);

  // Once verified (either via the link just now, or already true when
  // this page loaded) and we know the signed-in user's role, continue.
  useEffect(() => {
    if (auth.loading) return;
    const verifiedHere = linkState === "applied" || (linkState === "none" && auth.user?.emailVerified);
    if (verifiedHere && auth.user && auth.profile?.role) {
      router.replace(`/dashboard/${auth.profile.role.toLowerCase()}`);
    }
  }, [auth.loading, auth.user, auth.profile?.role, linkState, router]);

  // Nothing to verify and nobody signed in — send them to log in.
  useEffect(() => {
    if (!hasActionLink && !auth.loading && !auth.user) {
      router.replace("/login");
    }
  }, [hasActionLink, auth.loading, auth.user, router]);

  useEffect(() => {
    if (!cooldown) return undefined;
    const timer = window.setInterval(() => setCooldown((seconds) => Math.max(0, seconds - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [cooldown]);

  async function resend() {
    setBusy(true);
    setMessage("");
    try {
      await auth.sendVerificationEmail();
      setMessage("Verification email sent. Please check your inbox (and spam folder).");
      setCooldown(60);
    } catch (resendError) {
      setMessage(resendError.message);
    } finally {
      setBusy(false);
    }
  }

  async function confirmVerified() {
    setBusy(true);
    setMessage("");
    try {
      const verified = await auth.checkEmailVerified();
      if (verified) {
        setMessage("Your email has been verified. Redirecting…");
        if (auth.profile?.role) {
          router.replace(`/dashboard/${auth.profile.role.toLowerCase()}`);
        }
      } else {
        setMessage(
          "We couldn't confirm your email yet. Please open the verification email and click the link first, then try again.",
        );
      }
    } catch {
      setMessage("Unable to check your verification status. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function goBack() {
    await auth.logout();
    router.push("/register");
  }

  // ---- render ----
  if (linkState === "applying" || auth.loading) {
    return (
      <Shell>
        <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-red-50 text-2xl text-red-600">
          ✉
        </span>
        <p className="mt-5 text-sm text-slate-500">Verifying your email…</p>
      </Shell>
    );
  }

  if (linkState === "applied") {
    return (
      <Shell>
        <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-emerald-50 text-2xl text-emerald-600">
          ✓
        </span>
        <h1 className="mt-5 text-2xl font-bold text-slate-900">Email verified!</h1>
        <p className="mt-3 text-sm leading-6 text-slate-500">{message || "Your email has been verified."}</p>
        {!(auth.user && auth.profile?.role) && (
          <Link
            href="/login"
            className="mt-6 inline-block h-12 w-full rounded-xl bg-red-600 py-3 text-sm font-semibold text-white shadow-lg shadow-red-600/20 transition hover:bg-red-700"
          >
            Continue to sign in
          </Link>
        )}
      </Shell>
    );
  }

  const email = auth.user?.email || "your email address";

  return (
    <Shell>
      <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-red-50 text-2xl text-red-600">
        ✉
      </span>
      <h1 className="mt-5 text-2xl font-bold text-slate-900">Check your email</h1>
      <p className="mt-3 text-sm leading-6 text-slate-500">
        We&rsquo;ve sent a verification link to <strong className="text-slate-800">{email}</strong>. Please click
        the link in the email to verify your account.
      </p>
      {message && (
        <p className={`mt-4 text-xs ${/unable|couldn|invalid/i.test(message) ? "text-red-600" : "text-emerald-600"}`}>
          {message}
        </p>
      )}
      <button
        disabled={busy}
        onClick={confirmVerified}
        className="mt-6 h-12 w-full rounded-xl bg-red-600 text-sm font-semibold text-white shadow-lg shadow-red-600/20 transition hover:bg-red-700 disabled:opacity-60"
      >
        {busy ? "Checking…" : "I've Verified My Email"}
      </button>
      <button
        disabled={busy || cooldown > 0}
        onClick={resend}
        className="mt-4 text-xs font-semibold text-red-600 disabled:text-slate-400"
      >
        {cooldown > 0 ? `Resend Verification Email (${cooldown}s)` : "Resend Verification Email"}
      </button>
      <p className="mt-6 text-xs text-slate-500">
        Wrong email?{" "}
        <button onClick={goBack} className="font-semibold text-red-600">
          Go back
        </button>
      </p>
    </Shell>
  );
}
