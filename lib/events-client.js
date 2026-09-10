"use client";

// Direct client-SDK reads for the Student/Volunteer/Facilitator "browse and
// register" view. Firestore rules (academyEvents: read if admin() or
// published==true; participants/{userId}: read if admin() or
// request.auth.uid==userId) allow this without any API route — mutation
// (register/cancel) still goes through /api/events/register, since capacity
// enforcement needs a transaction a security rule can't safely express.
import { collection, doc, getDoc, onSnapshot, query, where } from "firebase/firestore";
import { db } from "./firebase";

export function subscribePublishedEvents(onData, onError) {
  if (!db) return () => {};
  return onSnapshot(
    query(collection(db, "academyEvents"), where("published", "==", true)),
    (snapshot) => onData(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))),
    onError,
  );
}

export async function loadMyParticipation(eventId, uid) {
  if (!db || !eventId || !uid) return null;
  const snapshot = await getDoc(doc(db, "academyEvents", eventId, "participants", uid));
  return snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null;
}
