"use client";

import { collection, getCountFromServer, getDocs, limit, orderBy, query, where } from "firebase/firestore";
import { db } from "./firebase";

const plain = (snapshot) => snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));

// Director/Admin can read `events`/`activities` fully unscoped — confirmed
// via firestore.rules' bare admin() branch on both collections. These are
// one-shot reads (not live subscriptions), matching how the rest of the
// Director Overview page already loads its data.

export async function loadUpcomingEvents(max = 5) {
  if (!db) return [];
  const today = new Date().toISOString().slice(0, 10);
  // Only orderBy("date") — the same field as the range filter, which
  // Firestore auto-indexes. A second orderBy on startTime would need a new
  // composite index, so same-day ordering is instead done client-side
  // below.
  const snapshot = await getDocs(query(collection(db, "events"), where("date", ">=", today), orderBy("date")));
  return plain(snapshot)
    .sort((a, b) => a.date.localeCompare(b.date) || (a.startTime || "").localeCompare(b.startTime || ""))
    .slice(0, max);
}

export async function loadRecentActivities(max = 8) {
  if (!db) return [];
  const snapshot = await getDocs(query(collection(db, "activities"), orderBy("createdAt", "desc"), limit(max)));
  return plain(snapshot);
}

// A real aggregation count (no documents downloaded) — enrollments have
// only ever been written with status "active" or "withdrawn" in this
// schema; this is the withdrawn half of that real breakdown.
export async function countWithdrawnEnrollments() {
  if (!db) return 0;
  const snapshot = await getCountFromServer(query(collection(db, "enrollments"), where("status", "==", "withdrawn")));
  return snapshot.data().count;
}
