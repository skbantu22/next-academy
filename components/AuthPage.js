"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "../lib/auth-context";

function Logo() {
  return (
    <Link
      href="/"
      className="flex items-center justify-center gap-3 text-xl font-bold tracking-tight text-slate-900"
    >
      <span className="grid h-12 w-12 place-items-center rounded-2xl bg-red-600 text-xl text-white shadow-xl shadow-red-600/20">
        N
      </span>
      <span>Next Academy</span>
    </Link>
  );
}

export default function AuthPage({ mode = "login" }) {
  const router = useRouter();
  const auth = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [verification, setVerification] = useState(false);
  const [resetMode, setResetMode] = useState(false);

  useEffect(() => {
    if (!auth.loading && auth.user?.emailVerified && auth.profile?.role) {
      router.replace(`/dashboard/${auth.profile.role.toLowerCase()}`);
    }
  }, [auth.loading, auth.profile?.role, auth.user, router]);

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setNotice("");
    auth.clearError();
    try {
      if (resetMode) {
        await auth.resetPassword(email);
        setNotice("Password reset email sent. Check your inbox.");
      } else if (mode === "register") {
        await auth.register(email, password, name);
        setVerification(true);
      } else {
        await auth.login(email, password);
      }
    } catch {
      // Auth context provides the user-facing message.
    } finally {
      setBusy(false);
    }
  }

  async function social(provider) {
    setBusy(true);
    auth.clearError();
    try {
      await auth.socialLogin(provider);
    } catch {
      // Auth context provides the user-facing message.
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    setBusy(true);
    auth.clearError();
    try {
      await auth.resendVerificationEmail();
      setNotice("A new verification email has been sent.");
    } catch (verificationError) {
      setNotice(verificationError.message);
    } finally {
      setBusy(false);
    }
  }

  async function checkVerification() {
    setBusy(true);
    auth.clearError();
    try {
      const verified = await auth.refreshVerification();
      if (!verified)
        setNotice(
          "Your email is not verified yet. Open the email link, then try again.",
        );
    } catch (verificationError) {
      setNotice(verificationError.message);
    } finally {
      setBusy(false);
    }
  }

  const title = resetMode
    ? "Reset your password"
    : mode === "register"
      ? "Create your account"
      : "Welcome back";
  const subtitle = resetMode
    ? "Enter your email to receive a secure reset link."
    : mode === "register"
      ? "Join the Next Academy learning community."
      : "Sign in to access your learning workspace.";
  const message = auth.error || notice;

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-red-950 via-slate-900 to-red-900 p-4 text-slate-800 selection:bg-red-600 selection:text-white sm:p-6">
      <div className="w-full max-w-md rounded-3xl border border-slate-700/50 bg-white/95 p-6 shadow-2xl backdrop-blur-xl sm:p-8">
        <div className="mb-8 text-center">
          <Logo />
          <p className="mt-2 text-[10px] font-semibold uppercase tracking-[.18em] text-slate-500">
            Your educational & community center
          </p>
        </div>
        {verification ? (
          <div className="text-center">
            <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-red-50 text-2xl text-red-600">
              ✉
            </span>
            <h1 className="mt-5 text-2xl font-bold text-slate-900">
              Check your email
            </h1>
            <p className="mt-3 text-sm leading-6 text-slate-500">
              We sent a verification link to{" "}
              <strong className="text-slate-800">{email}</strong>. Verify your
              email before signing in.
            </p>
            {message && (
              <p
                className={`mt-4 text-xs ${auth.error ? "text-red-600" : "text-emerald-600"}`}
              >
                {message}
              </p>
            )}
            <button
              disabled={busy}
              onClick={checkVerification}
              className="mt-6 h-12 w-full rounded-xl bg-red-600 text-sm font-semibold text-white shadow-lg shadow-red-600/20 transition hover:bg-red-700 disabled:opacity-60"
            >
              {busy ? "Checking..." : "I have verified my email"}
            </button>
            <button
              disabled={busy}
              onClick={resend}
              className="mt-4 text-xs font-semibold text-red-600"
            >
              Resend verification email
            </button>
            <p className="mt-6 text-xs text-slate-500">
              Wrong email?{" "}
              <button
                onClick={() => setVerification(false)}
                className="font-semibold text-red-600"
              >
                Go back
              </button>
            </p>
          </div>
        ) : (
          <>
            <div className="mb-6 flex rounded-xl bg-slate-100 p-1">
              <a
                href="/login"
                className={`flex-1 rounded-lg py-2 text-center text-sm font-semibold ${mode === "login" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500"}`}
              >
                Sign In
              </a>
              <a
                href="/register"
                className={`flex-1 rounded-lg py-2 text-center text-sm font-semibold ${mode === "register" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500"}`}
              >
                Register
              </a>
            </div>
            <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
            <p className="mt-1 text-xs text-slate-500">{subtitle}</p>
            {!resetMode && (
              <div className="mt-6 grid grid-cols-2 gap-3">
                <button
                  disabled={busy}
                  onClick={() => social("google")}
                  className="h-11 rounded-xl border border-slate-200 text-xs font-semibold hover:bg-slate-50"
                >
                  G Google
                </button>
                <button
                  disabled={busy}
                  onClick={() => social("facebook")}
                  className="h-11 rounded-xl border border-slate-200 text-xs font-semibold hover:bg-slate-50"
                >
                  f Facebook
                </button>
              </div>
            )}
            {!resetMode && (
              <div className="my-5 flex items-center gap-3 text-[10px] uppercase tracking-wider text-slate-400">
                <i className="h-px flex-1 bg-slate-200" />
                or email
                <i className="h-px flex-1 bg-slate-200" />
              </div>
            )}
            <form onSubmit={submit} className="space-y-4">
              {mode === "register" && !resetMode && (
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
                  Full name
                  <input
                    required
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-normal outline-none focus:ring-2 focus:ring-red-500"
                    placeholder="Alex Morgan"
                  />
                </label>
              )}
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
                Email address
                <input
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-normal outline-none focus:ring-2 focus:ring-red-500"
                  placeholder="you@example.com"
                  type="email"
                />
              </label>
              {!resetMode && (
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
                  Password
                  <input
                    required
                    minLength={6}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-normal outline-none focus:ring-2 focus:ring-red-500"
                    placeholder="Password"
                    type="password"
                  />
                </label>
              )}
              {message && (
                <p
                  className={`text-xs ${auth.error ? "text-red-600" : "text-emerald-600"}`}
                >
                  {message}
                </p>
              )}
              <button
                disabled={busy || !auth.firebaseConfigured}
                className="w-full rounded-xl bg-red-600 py-3 text-sm font-semibold text-white shadow-lg shadow-red-600/20 transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {busy
                  ? "Please wait..."
                  : resetMode
                    ? "Send reset link"
                    : mode === "register"
                      ? "Register & Start"
                      : "Access Workspace"}
                <span className="ml-2">→</span>
              </button>
            </form>
            <div className="mt-5 flex flex-wrap justify-between gap-3 text-xs">
              {!resetMode && mode === "login" && (
                <button
                  onClick={() => {
                    auth.clearError();
                    setResetMode(true);
                  }}
                  className="font-semibold text-red-600"
                >
                  Forgot password?
                </button>
              )}
              {resetMode && (
                <button
                  onClick={() => {
                    auth.clearError();
                    setResetMode(false);
                  }}
                  className="font-semibold text-red-600"
                >
                  Back to sign in
                </button>
              )}
              {!resetMode && (
                <span className="text-slate-500">
                  {mode === "login" ? "New here?" : "Already registered?"}{" "}
                  <a
                    href={mode === "login" ? "/register" : "/login"}
                    className="font-semibold text-red-600"
                  >
                    {mode === "login" ? "Create account" : "Sign in"}
                  </a>
                </span>
              )}
            </div>
          </>
        )}
        <p className="mt-6 text-center text-[10px] text-slate-400">
          Secure authentication powered by Firebase.
        </p>
      </div>
    </main>
  );
}
