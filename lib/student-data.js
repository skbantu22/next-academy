import { collection, doc, getDoc, onSnapshot, query, where } from "firebase/firestore";
import { db } from "./firebase";

// Direct-client reads, same pattern as lib/teacher-data.js — Firestore
// rules already scope `enrollments`/`payments` reads to
// `resource.data.studentId == request.auth.uid`, so a Student can only
// ever see their own admission/payment records this way, never anyone
// else's, with no server API route needed.

function reportQueryError(error, { collectionName, queryDescription, uid, onError }) {
  console.error(`[student-data] ${collectionName} query failed`, {
    queryDescription,
    uid,
    code: error?.code || "unknown",
    message: error?.message || "unknown",
  });
  onError?.(error, collectionName);
}

// Course titles rarely change while a student is looking at this page, so a
// one-time fetch per courseId (refreshed whenever the enrollment set
// changes) is enough — no need for a nested live subscription per course.
async function loadCourseInfo(courseId) {
  if (!db || !courseId) return null;
  const snapshot = await getDoc(doc(db, "courses", courseId));
  return snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null;
}

export function subscribeMyEnrollments(uid, onData, onError) {
  if (!db || !uid) return () => {};
  return onSnapshot(
    query(collection(db, "enrollments"), where("studentId", "==", uid)),
    async (snapshot) => {
      const enrollments = snapshot.docs
        .map((item) => ({ id: item.id, ...item.data() }))
        .filter((item) => item.status !== "withdrawn");
      const courseIds = [...new Set(enrollments.map((item) => item.courseId))];
      const courseEntries = await Promise.all(courseIds.map((id) => loadCourseInfo(id).then((course) => [id, course])));
      const courseMap = new Map(courseEntries);
      onData(
        enrollments.map((item) => ({
          ...item,
          courseTitle: courseMap.get(item.courseId)?.title || "Untitled training",
          courseCode: courseMap.get(item.courseId)?.courseCode || item.courseId,
        })),
      );
    },
    (error) =>
      reportQueryError(error, {
        collectionName: "enrollments",
        queryDescription: `collection(enrollments) where studentId == ${uid}`,
        uid,
        onError,
      }),
  );
}

export function subscribeMyPayments(uid, onData, onError) {
  if (!db || !uid) return () => {};
  return onSnapshot(
    query(collection(db, "payments"), where("studentId", "==", uid)),
    (snapshot) => onData(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))),
    (error) =>
      reportQueryError(error, {
        collectionName: "payments",
        queryDescription: `collection(payments) where studentId == ${uid}`,
        uid,
        onError,
      }),
  );
}
