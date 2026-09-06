"use client";

import { useEffect } from "react";
import { useAuth } from "../lib/auth-context";
import { useRouter } from "next/navigation";

export default function AuthGate({ children }) {
  const { user, profile, loading, firebaseConfigured } = useAuth();
  const router = useRouter();
  const requiresVerification = Boolean(
    user?.providerData?.some(
      (provider) => provider.providerId === "password",
    ) && !user.emailVerified,
  );

  useEffect(() => {
    if (firebaseConfigured && !loading && (!user || requiresVerification)) {
      router.replace("/login");
    }
  }, [firebaseConfigured, loading, requiresVerification, router, user]);

  if (loading)
    return (
      <div className="grid min-h-screen place-items-center bg-[#f6f8f5] text-sm text-[#77817d]">
        Loading your learning home...
      </div>
    );
  if (!firebaseConfigured) return children;
  if (!user || requiresVerification)
    return (
      <div className="grid min-h-screen place-items-center bg-[#f6f8f5] text-sm text-[#77817d]">
        Redirecting to login...
      </div>
    );
  return children;
}
