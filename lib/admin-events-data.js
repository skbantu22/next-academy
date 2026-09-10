"use client";

import { collection, onSnapshot } from "firebase/firestore";
import { db } from "./firebase";

// Live Admin/Director view of ALL academyEvents (published AND
// unpublished/draft) — the exact same collection the public landing
// page's Event Calendar (lib/public-events-data.js) and this same Event
// Management dashboard already read, just without the `published == true`
// filter. Backed by firestore.rules' `admin()` branch on that collection
// (`allow read: if resource.data.published == true || admin() || ...`),
// so this only ever succeeds for a signed-in Admin/Director — no new
// collection, no duplicated data, no separate backend.
export function subscribeAllEvents(onData, onError) {
  if (!db) return () => {};
  return onSnapshot(
    collection(db, "academyEvents"),
    (snapshot) => onData(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))),
    (error) => onError?.(error),
  );
}
