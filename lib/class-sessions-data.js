"use client";

import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db, auth } from "./firebase";

async function request(path, options = {}) {
  const token = await auth?.currentUser?.getIdToken();
  if (!token) throw new Error("Your session has expired. Please sign in again.");
  const response = await fetch(path, {
    ...options,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...options.headers },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || "Unable to complete this request. Please try again.");
  return data;
}

// Reads go directly through the client SDK — firestore.rules' classSessions
// block already scopes this correctly (admin() / ownsClass() /
// enrolledInClass()), same pattern as every other class-scoped collection
// in this app. Writes always go through /api/class-sessions so Teacher
// ownership is verified server-side (Admin SDK bypasses rules).
export function subscribeCourseClassSessions(courseId, onData, onError) {
  if (!db || !courseId) return () => {};
  return onSnapshot(
    query(collection(db, "classSessions"), where("courseId", "==", courseId)),
    (snapshot) => onData(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })).sort((a, b) => String(a.date).localeCompare(String(b.date)))),
    (error) => onError?.(error),
  );
}

// A student's own upcoming (and past) classes — one query per enrolled
// class, since Firestore doesn't support an OR across many classIds
// cleanly with `enrolledInClass`'s per-document rule check. Enrollment
// lists are small (a handful of courses per student) so this stays cheap.
export function subscribeMySessionsForClasses(classIds, onData, onError) {
  if (!db || !classIds?.length) {
    onData([]);
    return () => {};
  }
  const results = new Map();
  const unsubs = classIds.map((classId) =>
    onSnapshot(
      query(collection(db, "classSessions"), where("classId", "==", classId)),
      (snapshot) => {
        results.set(classId, snapshot.docs.map((item) => ({ id: item.id, ...item.data() })));
        onData([...results.values()].flat().sort((a, b) => String(a.date).localeCompare(String(b.date))));
      },
      (error) => onError?.(error),
    ),
  );
  return () => unsubs.forEach((unsub) => unsub());
}

// Start/refresh/stop a session's live attendance QR — see
// app/api/teacher/class-sessions/qr for the full flow. Kept as its own
// small endpoint (not folded into /api/class-sessions' PATCH) since it's a
// fundamentally different kind of operation (issuing a short-lived signed
// token) from editing session details.
export const manageSessionQr = (sessionId, actionName) =>
  request("/api/teacher/class-sessions/qr", { method: "POST", body: JSON.stringify({ sessionId, action: actionName }) });

export const createClassSession = (data) => request("/api/class-sessions", { method: "POST", body: JSON.stringify(data) });
export const updateClassSession = (data) => request("/api/class-sessions", { method: "PATCH", body: JSON.stringify(data) });
export const deleteClassSession = (id) => request("/api/class-sessions", { method: "DELETE", body: JSON.stringify({ id }) });
