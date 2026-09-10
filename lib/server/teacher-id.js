import { FieldValue } from "firebase-admin/firestore";

// Mirrors lib/server/student-id.js's nextStudentCode exactly — a separate
// counter document so Teacher IDs (TCH-###) and Student IDs (STU-###)
// number independently.
export async function nextTeacherCode(db) {
  const ref = db.collection("_counters").doc("teachers");
  return db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    const next = (snapshot.data()?.lastTeacherNumber || 0) + 1;
    transaction.set(ref, { lastTeacherNumber: next, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    return `TCH-${String(next).padStart(3, "0")}`;
  });
}
