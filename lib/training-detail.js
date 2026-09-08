import { collection, doc, documentId, onSnapshot, query, where } from "firebase/firestore";
import { db } from "./firebase";

export function subscribeCourse(courseId, onData, onError) {
  if (!db || !courseId) return () => {};
  return onSnapshot(
    doc(db, "courses", courseId),
    (snapshot) => {
      if (!snapshot.exists()) {
        onError(new Error("Training not found."));
        return;
      }
      onData({ id: snapshot.id, ...snapshot.data() });
    },
    onError,
  );
}

export function subscribeCourseClasses(courseId, onData, onError) {
  if (!db || !courseId) return () => {};
  return onSnapshot(
    query(collection(db, "classes"), where("courseId", "==", courseId)),
    (snapshot) => onData(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))),
    onError,
  );
}

export function subscribeClassAttendance(classIds, onData, onError) {
  if (!db || !classIds.length) {
    onData([]);
    return () => {};
  }
  const chunks = [];
  for (let i = 0; i < classIds.length; i += 30) chunks.push(classIds.slice(i, i + 30));
  const results = new Map();
  const unsubscribers = chunks.map((chunk, index) =>
    onSnapshot(
      query(collection(db, "attendance"), where("classId", "in", chunk)),
      (snapshot) => {
        results.set(index, snapshot.docs.map((item) => ({ id: item.id, ...item.data() })));
        onData([...results.values()].flat());
      },
      onError,
    ),
  );
  return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
}

export async function loadUsersByIds(ids) {
  if (!db || !ids.length) return [];
  const uniqueIds = [...new Set(ids)];
  const chunks = [];
  for (let i = 0; i < uniqueIds.length; i += 30) chunks.push(uniqueIds.slice(i, i + 30));
  const { getDocs } = await import("firebase/firestore");
  const groups = await Promise.all(
    chunks.map((chunk) =>
      getDocs(query(collection(db, "users"), where(documentId(), "in", chunk))),
    ),
  );
  return groups.flatMap((snapshot) => snapshot.docs.map((item) => ({ id: item.id, ...item.data() })));
}
