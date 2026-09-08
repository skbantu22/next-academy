import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "./firebase";
import { subscribeTeacherCollection } from "./teacher-data";

export function subscribeTeacherPromotionLinks(teacherId, onData, onError) {
  return subscribeTeacherCollection("promotionLinks", teacherId, onData, onError);
}

export function subscribeTeacherLeads(teacherId, onData, onError) {
  return subscribeTeacherCollection("promotionLeads", teacherId, onData, onError);
}

export async function createPromotionLink(teacherId, courseId) {
  if (!db) throw new Error("Firebase is not configured.");
  const slug = crypto.randomUUID().replace(/-/g, "").slice(0, 8);
  await setDoc(doc(db, "promotionLinks", slug), {
    teacherId,
    courseId,
    active: true,
    viewCount: 0,
    clickCount: 0,
    registrationCount: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return slug;
}
