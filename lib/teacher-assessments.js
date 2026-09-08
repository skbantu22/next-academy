import { addDoc, collection, onSnapshot, query, serverTimestamp, where } from "firebase/firestore";
import { db } from "./firebase";

// Teacher gradebook only — recording a score after an offline quiz/
// assignment/exam. There is no student-facing "take this quiz" flow here.
export async function createAssessment(teacherId, { studentId, courseId, classId, type, title, score, maxScore, passingScore }) {
  if (!db) throw new Error("Firebase is not configured.");
  const numericScore = Number(score);
  const numericMax = Number(maxScore);
  const numericPassing = Number(passingScore);
  const status = Number.isFinite(numericScore) && Number.isFinite(numericPassing) && numericScore >= numericPassing ? "pass" : "fail";
  await addDoc(collection(db, "assessments"), {
    teacherId,
    studentId,
    courseId,
    classId: classId || "",
    type,
    title,
    score: Number.isFinite(numericScore) ? numericScore : null,
    maxScore: Number.isFinite(numericMax) ? numericMax : null,
    passingScore: Number.isFinite(numericPassing) ? numericPassing : null,
    status,
    createdAt: serverTimestamp(),
  });
}

export function subscribeCourseAssessments(teacherId, courseId, onData, onError) {
  if (!db || !teacherId || !courseId) return () => {};
  return onSnapshot(
    query(collection(db, "assessments"), where("teacherId", "==", teacherId), where("courseId", "==", courseId)),
    (snapshot) => onData(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))),
    onError,
  );
}
