"use client";

import { collection, doc, onSnapshot, query, updateDoc, where } from "firebase/firestore";
import { db } from "./firebase";

// Role-agnostic self-profile write — every field it's ever called with is
// one the Firestore rule's self-update guard already permits (it only
// blocks uid/role/teacherIds/active/qrVersion). Kept separate from
// lib/teacher-data.js's updateTeacherProfile so the still-working, still
// reachable /teacher/profile route is never touched by this change.
export async function updateMyProfile(uid, fields) {
  if (!db) throw new Error("Firebase is not configured.");
  await updateDoc(doc(db, "users", uid), fields);
}

function ordered(snapshot) {
  return snapshot.docs
    .map((item) => ({ id: item.id, ...item.data() }))
    .sort((a, b) => String(b.issueDate?.toMillis?.() || "").localeCompare(String(a.issueDate?.toMillis?.() || "")));
}

// First code to exercise the "read my own certificate" branch the
// certificates rule already grants (resource.data.studentId == auth.uid) —
// certificates are only ever issued by a Teacher to a Student, so this
// naturally returns empty for every non-Student role.
export function subscribeMyCertificates(uid, onData, onError) {
  if (!db || !uid) return () => {};
  return onSnapshot(
    query(collection(db, "certificates"), where("studentId", "==", uid)),
    (snapshot) => onData(ordered(snapshot)),
    (error) => onError?.(error),
  );
}
