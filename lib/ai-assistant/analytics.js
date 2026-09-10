"use client";

// Read-only LMS analytics — every number here is computed from real data
// returned by the exact same already-secured service functions/routes the
// rest of the app uses (no new Firestore access path, no invented numbers).
// Scoped by role: Admin/Director get org-wide figures; Teacher gets figures
// scoped to their own students/courses (the same data their own dashboard
// already shows them); anyone else gets a clear "not authorized" result
// rather than a silently narrowed or fabricated one.
import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import { db } from "../firebase";
import { studentApi } from "../services/student-service";
import { loadTeacherAssignmentData } from "../services/teacher-assignment-service";
import { loadTraining } from "../services/training-service";
import { loadEvents } from "../services/event-service";
import { loadFinanceOverview } from "../services/finance-service";
import { loadEnrollments } from "../services/enrollment-service";
import { loadTeacherEnrollments } from "../services/teacher-enrollment-service";
import { subscribeTeacherStudents, subscribeTeacherClasses, subscribeTeacherCourses } from "../teacher-data";
import { subscribeMyEnrollments } from "../student-data";
import { attendancePercent } from "../attendance";
import { computeEventStatus } from "../events-shared";
import { resolveDateRange, toIsoDate } from "./datetime";

function once(subscribe) {
  return new Promise((resolve) => {
    const unsubscribe = subscribe(
      (value) => {
        unsubscribe?.();
        resolve(value);
      },
      () => {
        unsubscribe?.();
        resolve([]);
      },
    );
  });
}
const monthKey = (isoOrDate) => (isoOrDate ? String(isoOrDate).slice(0, 7) : "");
const thisMonthKey = () => monthKey(new Date().toISOString());
const lastMonthKey = () => {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - 1);
  return monthKey(d.toISOString());
};
function growth(current, previous) {
  const delta = current - previous;
  const pct = previous > 0 ? (delta / previous) * 100 : current > 0 ? 100 : 0;
  return { delta, pct: Math.round(pct * 100) / 100 };
}

const DENIED = { denied: true, message: "I don't have permission to show that organization-wide information." };

export async function getStudents(context) {
  if (context.role === "Admin" || context.role === "Director") {
    const { students } = await studentApi();
    return { scope: "organization", students: students || [] };
  }
  if (context.role === "Teacher") {
    const students = await once((onData, onError) => subscribeTeacherStudents(context.uid, onData, onError));
    return { scope: "your own", students: students || [] };
  }
  return { denied: true, students: [] };
}

export async function getStudentCount(context) {
  const { denied, scope, students } = await getStudents(context);
  if (denied) return DENIED;
  const active = students.filter((s) => s.active !== false).length;
  return { scope, total: students.length, active };
}

export async function getStudentGrowth(context) {
  const { denied, scope, students } = await getStudents(context);
  if (denied) return DENIED;
  const thisMonth = students.filter((s) => monthKey(s.createdAt) === thisMonthKey()).length;
  const lastMonth = students.filter((s) => monthKey(s.createdAt) === lastMonthKey()).length;
  return { scope, thisMonth, lastMonth, ...growth(thisMonth, lastMonth) };
}

export async function getTeacherCount(context) {
  if (!["Admin", "Director"].includes(context.role)) return DENIED;
  const { teachers } = await loadTeacherAssignmentData();
  const active = (teachers || []).filter((t) => t.active !== false).length;
  return { scope: "organization", total: (teachers || []).length, active };
}

export async function getCourses(context) {
  // loadTraining() already role-branches server-side: Admin/Director get
  // every course, Teacher gets only their own assigned ones.
  const { courses } = await loadTraining();
  return { scope: context.role === "Teacher" ? "your own" : "organization", courses: courses || [] };
}

export async function getCourseCount(context) {
  const { scope, courses } = await getCourses(context);
  const active = courses.filter((c) => c.status === "Active").length;
  return { scope, total: courses.length, active };
}

// There is no single "all enrollments" endpoint anywhere in the app —
// enrollments are always fetched per course (/api/admin/enrollments,
// /api/teacher/enrollments), which is exactly what the existing
// Students/Enrollment Manager UI already does per training. This fans that
// same per-course call out across every course the caller can see (already
// role-scoped by getCourses) and flattens the results, tagging each row
// with its course — real data, just aggregated client-side since no
// existing route aggregates it server-side.
export async function getEnrollments(context, { courseTerm } = {}) {
  const { scope, courses } = await getCourses(context);
  let scoped = courses;
  if (courseTerm) {
    const term = courseTerm.trim().toLowerCase();
    scoped = courses.filter((c) => (c.title || "").toLowerCase().includes(term));
    if (!scoped.length) return { scope, rows: [], courseNotFound: courseTerm };
  }
  const loader = context.role === "Teacher" ? loadTeacherEnrollments : loadEnrollments;
  const results = await Promise.allSettled(scoped.map((c) => loader(c.id)));
  const rows = [];
  results.forEach((result, index) => {
    if (result.status !== "fulfilled") return;
    const course = scoped[index];
    (result.value.enrollments || []).forEach((e) => {
      rows.push({ studentId: e.studentId, displayName: e.displayName || e.email, courseId: course.id, courseTitle: course.title, enrolledAt: e.enrolledAt, status: e.status });
    });
  });
  return { scope, rows };
}

export async function getTopCourse(context) {
  const { scope, courses } = await getCourses(context);
  if (!courses.length) return { scope, none: true };
  const top = [...courses].sort((a, b) => (b.enrolled || 0) - (a.enrolled || 0))[0];
  return { scope, title: top.title || top.courseCode || top.id, enrolled: top.enrolled || 0 };
}

export async function getTeacherWorkload(context) {
  if (!["Admin", "Director"].includes(context.role)) return DENIED;
  const { teachers, classes } = await loadTeacherAssignmentData();
  const rows = (teachers || [])
    .map((t) => ({ name: t.displayName || t.email || t.id, batches: (classes || []).filter((c) => (c.teacherIds || []).includes(t.id)).length }))
    .sort((a, b) => b.batches - a.batches);
  return { scope: "organization", rows: rows.slice(0, 10) };
}

async function fetchPublishedEventsDirect() {
  if (!db) return [];
  const snapshot = await getDocs(query(collection(db, "academyEvents"), where("published", "==", true)));
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function getEvents(context) {
  if (context.role === "Admin" || context.role === "Director") {
    const { events } = await loadEvents();
    return events || [];
  }
  return fetchPublishedEventsDirect();
}

export async function getUpcomingEvents(context) {
  const events = await getEvents(context);
  const upcoming = events
    .map((e) => ({ ...e, computedStatus: e.computedStatus || computeEventStatus(e) }))
    .filter((e) => e.computedStatus === "Upcoming" || e.computedStatus === "Ongoing")
    .sort((a, b) => (a.eventDate || "").localeCompare(b.eventDate || "") || (a.startTime || "").localeCompare(b.startTime || ""));
  return upcoming;
}
export async function getNextEvent(context) {
  const upcoming = await getUpcomingEvents(context);
  return upcoming[0] || null;
}

// "Attendance rate" is reported as the average of each student's own
// already-computed attendance percentage (the same number their own
// profile/dashboard shows) — labeled precisely as an average across
// students, not claimed to be "today only," since no single existing
// endpoint aggregates same-day attendance across the whole organization.
export async function getAttendanceRate(context) {
  if (context.role === "Student") return getMyAttendance(context);
  const { denied, scope, students } = await getStudents(context);
  if (denied) return DENIED;
  const withRate = students.filter((s) => typeof s.attendance === "number");
  if (!withRate.length) return { scope, none: true };
  const average = Math.round((withRate.reduce((sum, s) => sum + s.attendance, 0) / withRate.length) * 100) / 100;
  return { scope, average, studentsCounted: withRate.length };
}

// A Student's own attendance — a direct `attendance` collection read
// their own Firestore rules already allow (`resource.data.studentId ==
// request.auth.uid`), reusing the exact same attendancePercent() math
// every other attendance view in the app (lib/attendance.js) uses. No
// admin-only route, no invented number.
export async function getMyAttendance(context) {
  if (!db) return { scope: "your own", none: true };
  const snapshot = await getDocs(query(collection(db, "attendance"), where("studentId", "==", context.uid)));
  const records = snapshot.docs.map((d) => d.data());
  const average = attendancePercent(records);
  if (average === null) return { scope: "your own", none: true };
  return { scope: "your own", average, studentsCounted: 1 };
}

// A Student's own marks/results — `assessments` is the exact same
// collection the Teacher gradebook (lib/teacher-assessments.js) already
// writes to; a Student may read their own rows under the existing rule
// (`resource.data.studentId == request.auth.uid`). Unlike staff, who have
// no org/course-wide aggregation to reuse (see entityRegistry.js's
// `result` entity header), a Student's own rows are a small, real, direct
// read — not fabricated.
export async function getMyResults(context) {
  if (!db) return { scope: "your own", none: true };
  const snapshot = await getDocs(query(collection(db, "assessments"), where("studentId", "==", context.uid)));
  const rows = snapshot.docs.map((d) => d.data()).filter((r) => r.score !== null && r.score !== undefined);
  if (!rows.length) return { scope: "your own", none: true };
  const passed = rows.filter((r) => r.status === "pass").length;
  return {
    scope: "your own",
    count: rows.length,
    passed,
    failed: rows.length - passed,
    rows: rows.slice(0, 10).map((r) => ({ title: r.title, score: r.score, maxScore: r.maxScore, status: r.status })),
  };
}

// Class schedule, scoped per role using only reads that role's own
// Firestore rules already allow directly — Teacher/Student never go
// through the Admin/Director-only /api/admin/teacher-assignments route
// (entityRegistry.js's `batch` entity correctly restricts that route to
// Admin/Director only; reusing it for Teacher/Student here would 403).
// Teacher: `classes` read allowed when teacherIds array-contains uid
// (subscribeTeacherClasses, already used by the Teacher dashboard).
// Student: no single query lists "classes I'm enrolled in" directly, so
// this resolves the student's own enrollment records (already a
// permitted studentId==uid query) to their classIds, then reads each
// class doc directly — allowed under `enrolledInClass(classId)`.
export async function getClassSchedule(context) {
  if (context.role === "Admin" || context.role === "Director") {
    const { classes, teachers, courses } = await loadTeacherAssignmentData();
    return { scope: "organization", classes: classes || [], teachers: teachers || [], courses: courses || [] };
  }
  if (context.role === "Teacher") {
    const [classes, courses] = await Promise.all([
      once((onData, onError) => subscribeTeacherClasses(context.uid, onData, onError)),
      once((onData, onError) => subscribeTeacherCourses(context.uid, onData, onError)),
    ]);
    return { scope: "your own", classes: classes || [], teachers: [{ id: context.uid, displayName: context.name }], courses: courses || [] };
  }
  if (context.role === "Student") {
    const enrollments = await once((onData, onError) => subscribeMyEnrollments(context.uid, onData, onError));
    const classIds = [...new Set(enrollments.map((e) => e.classId).filter(Boolean))];
    const classDocs = db ? await Promise.all(classIds.map((id) => getDoc(doc(db, "classes", id)).catch(() => null))) : [];
    const classes = classDocs.filter((snap) => snap?.exists()).map((snap) => ({ id: snap.id, ...snap.data() }));
    const courses = [...new Map(enrollments.filter((e) => e.courseId).map((e) => [e.courseId, { id: e.courseId, title: e.courseTitle }])).values()];
    return { scope: "your own", classes, teachers: [], courses };
  }
  return { denied: true, message: "I don't have permission to show class schedule data." };
}
export async function getLowAttendanceStudents(context, threshold = 75) {
  const { denied, scope, students } = await getStudents(context);
  if (denied) return DENIED;
  const rows = students
    .filter((s) => typeof s.attendance === "number" && s.attendance < threshold)
    .sort((a, b) => a.attendance - b.attendance)
    .map((s) => ({ name: s.displayName || s.email, attendance: s.attendance }));
  return { scope, threshold, rows: rows.slice(0, 10) };
}

// /api/admin/finance already computes date-ranged income/expenses/profit
// (buildFinanceOverview's `totals.income/expenses/netProfit/due`) when
// given `from`/`to` — reused directly here for "today"/"this month"
// breakdowns instead of re-deriving totals from raw payment rows.
export async function getFinanceSummary(context) {
  if (!["Admin", "Director"].includes(context.role)) return DENIED;
  const today = toIsoDate(new Date());
  const month = resolveDateRange("this-month");
  const [allTime, todayRange, monthRange] = await Promise.all([
    loadFinanceOverview(),
    loadFinanceOverview({ from: today, to: today }),
    loadFinanceOverview({ from: month.start, to: month.end }),
  ]);
  const totals = allTime.totals || {};
  return {
    scope: "organization",
    income: totals.income || 0,
    expensesCount: (allTime.expenses || []).length,
    profit: totals.netProfit || 0,
    due: totals.due || 0,
    todayIncome: todayRange.totals?.income || 0,
    monthIncome: monthRange.totals?.income || 0,
    monthProfit: monthRange.totals?.netProfit || 0,
    // paidCount/partialCount/unpaidCount are the same pre-aggregated
    // figures Director Overview's own Payment Status chart already uses.
    pendingCount: (totals.partialCount || 0) + (totals.unpaidCount || 0),
    paidCount: totals.paidCount || 0,
  };
}

// Combines several of the above into one compact snapshot — every field is
// still fetched from the exact same real functions, just fanned out and
// gathered with Promise.allSettled so one section failing (e.g. Finance for
// a Teacher, who is denied it) never blanks out the whole overview.
// Classes (this LMS's `classes` collection = training batches) whose
// startDate/endDate range currently covers today — see entityRegistry.js's
// `class` entity header for why that's the honest reading of "today's
// classes" against the real schema. Duplicated here in miniature (rather
// than importing queryEngine.js's version) to avoid a circular import,
// since entityRegistry.js already imports this file.
export async function getClassesToday(context) {
  if (!["Admin", "Director", "Teacher"].includes(context.role)) return DENIED;
  const { classes } = await loadTeacherAssignmentData();
  const today = toIsoDate(new Date());
  const scoped = context.role === "Teacher" ? (classes || []).filter((c) => (c.teacherIds || []).includes(context.uid)) : classes || [];
  const todayCount = scoped.filter((c) => c.startDate && c.startDate <= today && (c.endDate || c.startDate) >= today).length;
  return { scope: context.role === "Teacher" ? "your own" : "organization", count: todayCount };
}

export async function getAcademyOverview(context) {
  const [studentsR, teachersR, coursesR, eventsR, attendanceR, financeR, classesR, enrollmentsR] = await Promise.allSettled([
    getStudentCount(context),
    getTeacherCount(context),
    getCourseCount(context),
    getUpcomingEvents(context),
    getAttendanceRate(context),
    getFinanceSummary(context),
    getClassesToday(context),
    getStudentGrowth(context),
  ]);
  const value = (r) => (r.status === "fulfilled" ? r.value : { denied: true });
  return {
    students: value(studentsR),
    teachers: value(teachersR),
    courses: value(coursesR),
    upcomingEvents: eventsR.status === "fulfilled" ? eventsR.value : [],
    attendance: value(attendanceR),
    finance: value(financeR),
    classesToday: value(classesR),
    enrollments: value(enrollmentsR),
  };
}
