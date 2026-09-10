"use client";

import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "./firebase";

// Public, unauthenticated-safe live feed of the SAME academyEvents
// collection the Director/Admin Event Management dashboard already
// manages (components/events/EventManagement.jsx, app/api/admin/events).
// No new collection, no duplicated data — this is a direct client
// Firestore read scoped by firestore.rules' `published == true` branch on
// `academyEvents`, so a signed-out landing-page visitor's onSnapshot
// listener updates live the moment an event is published, edited,
// unpublished, or deleted from the dashboard.
export function subscribePublishedEvents(onData, onError) {
  if (!db) return () => {};
  return onSnapshot(
    query(collection(db, "academyEvents"), where("published", "==", true)),
    (snapshot) => onData(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))),
    (error) => onError?.(error),
  );
}
