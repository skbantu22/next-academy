import { FieldValue } from "firebase-admin/firestore";

// Single counter, shared by every path that can create/complete a Student
// profile (Admin-created students, self-registered students, and this
// backfill helper) so STU-### numbers are always unique and sequential.
export async function nextStudentCode(db) {
  const ref = db.collection("_counters").doc("students");
  return db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    const next = (snapshot.data()?.lastStudentNumber || 0) + 1;
    transaction.set(ref, { lastStudentNumber: next, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    return `STU-${String(next).padStart(3, "0")}`;
  });
}

// Idempotent: returns the existing studentId if the user already has one,
// otherwise mints and persists the next one. Never touches uid, role, or
// any other field. Safe to call repeatedly (e.g. on every login) — it's a
// no-op once a studentId exists.
export async function ensureStudentCode(db, uid) {
  const ref = db.collection("users").doc(uid);
  const snapshot = await ref.get();
  if (!snapshot.exists) return null;
  const data = snapshot.data();
  if (data.role !== "Student") return data.studentId || null;
  if (data.studentId) return data.studentId;
  const studentId = await nextStudentCode(db);
  await ref.update({ studentId, updatedAt: FieldValue.serverTimestamp() });
  return studentId;
}
