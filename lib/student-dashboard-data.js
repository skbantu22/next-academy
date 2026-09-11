"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "./firebase";
import { subscribeMyEnrollments, subscribeMyAttendance } from "./student-data";
import { subscribeMyAchievements, subscribeMyCertificates } from "./achievement-data";
import { subscribeMySessionsForClasses } from "./class-sessions-data";
import { attendanceSummary } from "./attendance";

// One real-time aggregator for the Student Dashboard home — every field it
// returns is derived from the exact same collections/subscriptions this
// app already uses elsewhere (enrollments, attendance, achievements,
// certificates, classSessions, assessments); nothing here is a second data
// store. Firestore's own persistent local cache (enabled once in
// lib/firebase.js) is what makes every one of these `onSnapshot` listeners
// keep serving cached data offline and reconcile automatically when the
// network returns — this hook doesn't need its own offline logic.
//
// NOTE ON "Due This Week": this LMS has no assignment/quiz/exam entity
// with a due date anywhere in its schema (the existing `assignments`/
// `submissions` collections exist in rules/subscriptions but have no
// creation UI anywhere and are never populated) — so this is always a
// real, honest 0 rather than a fabricated number. See the audit note in
// the Student Dashboard component for the same disclosure.
function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function daysAgoKey(days) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
}

export function useStudentDashboardData(uid) {
  const [enrollments, setEnrollments] = useState([]);
  const [enrollmentsLoaded, setEnrollmentsLoaded] = useState(false);
  const [attendance, setAttendance] = useState([]);
  const [attendanceLoaded, setAttendanceLoaded] = useState(false);
  const [achievements, setAchievements] = useState([]);
  const [certificates, setCertificates] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [assessments, setAssessments] = useState([]);
  const [lastSyncedAt, setLastSyncedAt] = useState(null);

  useEffect(() => {
    if (!uid) return undefined;
    return subscribeMyEnrollments(
      uid,
      (rows) => {
        setEnrollments(rows);
        setEnrollmentsLoaded(true);
        setLastSyncedAt(Date.now());
      },
      () => setEnrollmentsLoaded(true),
    );
  }, [uid]);

  useEffect(() => {
    if (!uid) return undefined;
    return subscribeMyAttendance(
      uid,
      (rows) => {
        setAttendance(rows);
        setAttendanceLoaded(true);
        setLastSyncedAt(Date.now());
      },
      () => setAttendanceLoaded(true),
    );
  }, [uid]);

  useEffect(() => {
    if (!uid) return undefined;
    return subscribeMyAchievements(uid, (rows) => { setAchievements(rows); setLastSyncedAt(Date.now()); }, () => {});
  }, [uid]);

  useEffect(() => {
    if (!uid) return undefined;
    return subscribeMyCertificates(uid, (rows) => { setCertificates(rows); setLastSyncedAt(Date.now()); }, () => {});
  }, [uid]);

  // Real gradebook scores (lib/teacher-assessments.js's createAssessment) —
  // the only genuinely populated "progress" signal in this schema, used
  // for the Course Progress bars and (when available) the Learning
  // Progress trend.
  useEffect(() => {
    if (!uid || !db) return undefined;
    return onSnapshot(
      query(collection(db, "assessments"), where("studentId", "==", uid)),
      (snapshot) => {
        setAssessments(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })));
        setLastSyncedAt(Date.now());
      },
      () => {},
    );
  }, [uid]);

  const classIds = useMemo(() => [...new Set(enrollments.map((item) => item.classId).filter(Boolean))], [enrollments]);
  const classIdsKey = classIds.join(",");
  useEffect(() => subscribeMySessionsForClasses(classIds, (rows) => { setSessions(rows); setLastSyncedAt(Date.now()); }, () => {}),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [classIdsKey]);

  const activeEnrollments = useMemo(() => enrollments.filter((item) => item.status !== "withdrawn"), [enrollments]);

  const courseStatusSummary = useMemo(() => {
    let active = 0;
    let completed = 0;
    let notStarted = 0;
    activeEnrollments.forEach((item) => {
      if (item.courseStatus === "Completed") completed += 1;
      else if (item.courseStatus === "Active") active += 1;
      else notStarted += 1;
    });
    return { active, completed, notStarted };
  }, [activeEnrollments]);

  // Real assessment-based progress per course — the same "score /
  // maxScore" formula already used server-side (certificate-core.js's
  // studentCourseScore). null when the student has no scored assessments
  // for that course yet (never a fabricated 0%).
  const courseProgress = useMemo(() => {
    return activeEnrollments.map((enrollment) => {
      const scores = assessments.filter((item) => item.courseId === enrollment.courseId && typeof item.score === "number" && typeof item.maxScore === "number" && item.maxScore > 0);
      const progress = scores.length
        ? Math.round(scores.reduce((sum, item) => sum + (item.score / item.maxScore) * 100, 0) / scores.length)
        : null;
      return { courseId: enrollment.courseId, courseTitle: enrollment.courseTitle, progress };
    });
  }, [activeEnrollments, assessments]);

  const attendanceStats = useMemo(() => attendanceSummary(attendance), [attendance]);

  // Consecutive days (ending today or yesterday) with a real attendance
  // record — the closest real "learning activity" unit this LMS tracks
  // (in-person class attendance), since there is no lesson/module
  // completion system to derive a streak from instead.
  const learningStreak = useMemo(() => {
    const attendedDates = new Set(attendance.filter((item) => ["present", "late"].includes(item.status)).map((item) => item.date));
    if (!attendedDates.size) return 0;
    let streak = 0;
    let cursor = new Date();
    // If nothing happened today yet, a streak ending yesterday still counts.
    if (!attendedDates.has(todayKey())) cursor.setDate(cursor.getDate() - 1);
    while (attendedDates.has(cursor.toISOString().slice(0, 10))) {
      streak += 1;
      cursor.setDate(cursor.getDate() - 1);
    }
    return streak;
  }, [attendance]);

  // No assignment/quiz/exam-with-a-due-date entity exists anywhere in this
  // schema (see this file's header note) — real and honest, always 0.
  const dueThisWeek = 0;

  const upcomingEvents = useMemo(() => {
    const today = todayKey();
    return sessions
      .filter((item) => item.date >= today && item.status !== "cancelled")
      .sort((a, b) => String(a.date).localeCompare(String(b.date)) || String(a.startTime || "").localeCompare(String(b.startTime || "")))
      .map((item) => {
        const enrollment = activeEnrollments.find((e) => e.classId === item.classId);
        return { ...item, courseTitle: enrollment?.courseTitle || "Training" };
      });
  }, [sessions, activeEnrollments]);

  // Weekly Learning Activity — real attendance records per weekday for the
  // current calendar week (Mon-first, matching this app's other weekly
  // views).
  const weeklyActivity = useMemo(() => {
    const now = new Date();
    const day = (now.getDay() + 6) % 7; // Monday = 0
    const monday = new Date(now);
    monday.setDate(now.getDate() - day);
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      return d.toISOString().slice(0, 10);
    });
    const counts = new Map(days.map((d) => [d, 0]));
    attendance.forEach((item) => {
      if (counts.has(item.date) && ["present", "late"].includes(item.status)) {
        counts.set(item.date, counts.get(item.date) + 1);
      }
    });
    const labels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    return days.map((d, i) => ({ day: labels[i], date: d, count: counts.get(d) || 0 }));
  }, [attendance]);

  // Learning Progress — real assessment-score trend when the student has
  // scored assessments (the genuine "progress" signal), otherwise real
  // attendance-rate trend (the next-best genuine activity signal this LMS
  // tracks), over the last 14 real calendar days. Never fabricated.
  const learningProgressTrend = useMemo(() => {
    const days = Array.from({ length: 14 }, (_, i) => daysAgoKey(13 - i));
    const hasScores = assessments.some((item) => typeof item.score === "number" && typeof item.maxScore === "number" && item.maxScore > 0);
    if (hasScores) {
      const byDay = new Map();
      assessments.forEach((item) => {
        const date = item.createdAt?.toDate?.().toISOString().slice(0, 10);
        if (!date || typeof item.score !== "number" || typeof item.maxScore !== "number" || !item.maxScore) return;
        if (!byDay.has(date)) byDay.set(date, []);
        byDay.get(date).push((item.score / item.maxScore) * 100);
      });
      return {
        metric: "score",
        points: days.map((date) => {
          const scores = byDay.get(date);
          return { date, value: scores?.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null };
        }),
      };
    }
    if (attendance.length) {
      const byDay = new Map();
      attendance.forEach((item) => {
        if (!byDay.has(item.date)) byDay.set(item.date, []);
        byDay.get(item.date).push(item);
      });
      return {
        metric: "attendance",
        points: days.map((date) => {
          const records = byDay.get(date);
          return { date, value: records?.length ? attendanceSummary(records).percent : null };
        }),
      };
    }
    return { metric: "none", points: [] };
  }, [assessments, attendance]);

  // Recent Activity — a real, merged, sorted feed built from existing
  // collections (never a separate activity log written for students):
  // enrollments (enrolled), attendance (marked), achievements (unlocked,
  // including "course_completion" type ones), certificates (earned).
  const recentActivity = useMemo(() => {
    const items = [];
    enrollments.forEach((item) => {
      const at = item.enrolledAt?.toDate?.();
      if (at) items.push({ id: `enroll-${item.id}`, type: "enrolled", label: `Enrolled in ${item.courseTitle}`, at });
    });
    attendance.forEach((item) => {
      const at = item.checkInAt?.toDate?.() || item.markedAt?.toDate?.();
      if (at) items.push({ id: `att-${item.id}`, type: "attendance", label: `Marked ${item.status} — ${item.courseTitle}${item.className ? ` (${item.className})` : ""}`, at });
    });
    achievements.forEach((item) => {
      const at = item.awardedAt?.toDate?.();
      if (at) items.push({ id: `ach-${item.id}`, type: "achievement", label: `Achievement unlocked — ${item.title}`, at });
    });
    certificates.forEach((item) => {
      const at = item.issueDate?.toDate?.() || item.createdAt?.toDate?.();
      if (at) items.push({ id: `cert-${item.id}`, type: "certificate", label: `Certificate earned — ${item.title || item.metadata?.courseName || "Certificate"}`, at });
    });
    return items.sort((a, b) => b.at - a.at).slice(0, 12);
  }, [enrollments, attendance, achievements, certificates]);

  const latestAchievement = useMemo(
    () => [...achievements].filter((item) => item.awardedAt).sort((a, b) => (b.awardedAt?.toMillis?.() || 0) - (a.awardedAt?.toMillis?.() || 0))[0] || null,
    [achievements],
  );
  const latestCertificate = useMemo(
    () => [...certificates].filter((item) => item.status !== "revoked").sort((a, b) => (b.issueDate?.toMillis?.() || b.createdAt?.toMillis?.() || 0) - (a.issueDate?.toMillis?.() || a.createdAt?.toMillis?.() || 0))[0] || null,
    [certificates],
  );

  return {
    loading: !enrollmentsLoaded || !attendanceLoaded,
    lastSyncedAt,
    activeCourses: activeEnrollments.length,
    dueThisWeek,
    learningStreak,
    achievementCount: achievements.length,
    attendanceStats,
    courseStatusSummary,
    courseProgress,
    upcomingEvents,
    weeklyActivity,
    learningProgressTrend,
    recentActivity,
    latestAchievement,
    latestCertificate,
  };
}
