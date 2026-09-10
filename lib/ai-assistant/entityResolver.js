"use client";

// Resolves a typed name ("Rahim", "Web Development") into real Firestore
// records, scoped by the caller's role through the exact same existing,
// already-secured data sources the rest of the LMS UI uses — this file
// introduces no new read path, only a name-matching layer on top of data
// that's already permission-filtered server-side.
import { studentApi } from "../services/student-service";
import { loadTeacherAssignmentData } from "../services/teacher-assignment-service";
import { loadTraining } from "../services/training-service";
import { subscribeTeacherStudents } from "../teacher-data";

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

function scoreMatch(query, candidates) {
  const term = query.trim().toLowerCase();
  if (!term) return [];
  const exact = candidates.filter((c) => c.searchText === term);
  if (exact.length) return exact;
  return candidates.filter((c) => c.searchText.includes(term));
}

// Returns { matches: [{id, label, sublabel, raw}] } — 0 matches = not found,
// 1 = resolved, 2+ = the caller must show a disambiguation list. Never picks
// one on the caller's behalf.
export async function resolveStudent(query, { role, uid }) {
  let students = [];
  if (role === "Admin" || role === "Director") {
    const result = await studentApi();
    students = result.students || [];
  } else if (role === "Teacher") {
    students = await once((onData, onError) => subscribeTeacherStudents(uid, onData, onError));
  }
  const candidates = students.map((s) => ({
    id: s.id,
    label: s.displayName || s.email || s.id,
    sublabel: s.studentId || s.email || "",
    searchText: `${s.displayName || ""} ${s.email || ""} ${s.studentId || ""} ${s.id}`.toLowerCase(),
    raw: s,
  }));
  return { matches: scoreMatch(query, candidates) };
}

export async function resolveTeacher(query, { role }) {
  let teachers = [];
  if (role === "Admin" || role === "Director") {
    const result = await loadTeacherAssignmentData();
    teachers = result.teachers || [];
  }
  const candidates = teachers.map((t) => ({
    id: t.id,
    label: t.displayName || t.email || t.id,
    sublabel: t.email || "",
    searchText: `${t.displayName || ""} ${t.email || ""} ${t.id}`.toLowerCase(),
    raw: t,
  }));
  return { matches: scoreMatch(query, candidates) };
}

// loadTraining() itself branches by role (Admin/Director see everything,
// Teacher sees only their own assigned courses) — no separate Teacher path
// needed here.
export async function resolveCourse(query) {
  const result = await loadTraining();
  const candidates = (result.courses || []).map((c) => ({
    id: c.id,
    label: c.title || c.courseCode || c.id,
    sublabel: c.courseCode || "",
    searchText: `${c.title || ""} ${c.courseCode || ""} ${c.id}`.toLowerCase(),
    raw: c,
  }));
  return { matches: scoreMatch(query, candidates) };
}

export async function resolveClass(query, { role, courseId } = {}) {
  let classes = [];
  if (role === "Admin" || role === "Director") {
    const result = await loadTeacherAssignmentData();
    classes = result.classes || [];
  }
  const scoped = courseId ? classes.filter((c) => c.courseId === courseId) : classes;
  const candidates = scoped.map((c) => ({
    id: c.id,
    label: c.name || c.id,
    sublabel: "",
    searchText: `${c.name || ""} ${c.id}`.toLowerCase(),
    raw: c,
  }));
  return { matches: scoreMatch(query, candidates) };
}

export const RESOLVERS = {
  student: resolveStudent,
  teacher: resolveTeacher,
  course: resolveCourse,
  class: resolveClass,
};
