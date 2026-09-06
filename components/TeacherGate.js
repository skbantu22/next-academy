"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../lib/auth-context";

export default function TeacherGate({ children }) {
  const { user, profile, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/login");
    } else if (profile?.role && profile.role !== "Teacher") {
      router.replace(`/dashboard/${profile.role.toLowerCase()}`);
    }
  }, [loading, profile?.role, router, user]);

  if (loading || !user || !profile || profile.role !== "Teacher") {
    return (
      <div className="grid min-h-screen place-items-center bg-slate-100 text-sm text-slate-500">
        Checking teacher access...
      </div>
    );
  }
  return children;
}
