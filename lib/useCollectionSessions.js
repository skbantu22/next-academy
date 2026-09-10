"use client";

import { useEffect, useMemo, useState } from "react";
import { subscribeMyEnrollments } from "./student-data";
import { subscribeMySessionsForClasses } from "./class-sessions-data";

// Shared by both checkout entry points (single-product "Order Now" and the
// cart "Checkout") so there is exactly one place that resolves a buyer's
// real, upcoming, real class sessions to offer as a pickup/collection
// option — never a fabricated date. A Student's own enrolled classes'
// sessions; any other role gets none (no fabricated fallback), so the
// Collection section is simply omitted for them.
export function useUpcomingCollectionSessions(uid, role) {
  const [sessions, setSessions] = useState([]);

  useEffect(() => {
    if (role !== "Student" || !uid) return undefined;
    let unsubSessions = () => {};
    const unsubEnrollments = subscribeMyEnrollments(
      uid,
      (enrollments) => {
        const classIds = [...new Set(enrollments.map((item) => item.classId).filter(Boolean))];
        unsubSessions();
        unsubSessions = subscribeMySessionsForClasses(classIds, setSessions, () => {});
      },
      () => {},
    );
    return () => {
      unsubEnrollments();
      unsubSessions();
    };
  }, [role, uid]);

  const today = new Date().toISOString().slice(0, 10);
  return useMemo(
    () => sessions.filter((item) => item.date >= today && item.status !== "cancelled"),
    [sessions, today],
  );
}

export function formatSessionDate(value) {
  if (!value) return "";
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });
}
