"use client";

import {
  collection,
  doc,
  getDoc,
  getDocs,
  increment,
  onSnapshot,
  query,
  serverTimestamp,
  where,
  writeBatch,
} from "firebase/firestore";
import { db } from "./firebase";

// Reused as-is, not duplicated — already role-agnostic despite living in
// teacher-data.js (it takes a bare conversationId, no teacher-specific
// logic). It sorts newest-first via that file's shared `ordered()` helper;
// callers wanting oldest-first for a message thread should reverse locally.
export { subscribeConversationMessages } from "./teacher-data";

function ordered(snapshot) {
  return snapshot.docs
    .map((item) => ({ id: item.id, ...item.data() }))
    .sort((a, b) =>
      String(b.updatedAt?.toMillis?.() || b.createdAt?.toMillis?.() || "").localeCompare(
        String(a.updatedAt?.toMillis?.() || a.createdAt?.toMillis?.() || ""),
      ),
    );
}

// Role-agnostic — reused by every dashboard shell (Admin/Director/Teacher/
// Student), not just Teacher. `lib/teacher-data.js` keeps its own
// Teacher-specific `subscribeTeacherConversations`/`sendTeacherMessage`
// untouched as a safety net; this is the generic replacement new call sites
// use going forward.
export function subscribeMyConversations(uid, onData, onError) {
  if (!db || !uid) return () => {};
  return onSnapshot(
    query(collection(db, "conversations"), where("participantIds", "array-contains", uid)),
    (snapshot) => onData(ordered(snapshot)),
    (error) => onError?.(error),
  );
}

function conversationId(uidA, uidB) {
  return [uidA, uidB].sort().join("_");
}

// Idempotent — safe to call every time a contact is clicked, even if the
// conversation already exists (a plain getDoc + merge:true, not a query).
export async function createConversationIfMissing({ uidA, roleA, nameA, uidB, roleB, nameB }) {
  if (!db) throw new Error("Firebase is not configured.");
  const id = conversationId(uidA, uidB);
  const ref = doc(db, "conversations", id);
  const existing = await getDoc(ref);
  if (existing.exists()) return id;

  // teacherId/studentId are keyed off each participant's actual role, not
  // "is this a verified assigned pair" — Admin-initiated conversations with
  // a Volunteer/Facilitator legitimately have both set to null. Both keys
  // must always be present (never omitted) because the conversations
  // `update` rule later compares them against the existing doc, and
  // comparing against a missing key throws.
  const teacherId = roleA === "Teacher" ? uidA : roleB === "Teacher" ? uidB : null;
  const studentId = roleA === "Student" ? uidA : roleB === "Student" ? uidB : null;

  await writeBatch(db)
    .set(
      ref,
      {
        participantIds: [uidA, uidB],
        participantNames: { [uidA]: nameA || "", [uidB]: nameB || "" },
        participantRoles: { [uidA]: roleA, [uidB]: roleB },
        teacherId,
        studentId,
        lastMessage: "",
        lastMessageAt: null,
        unreadCount: { [uidA]: 0, [uidB]: 0 },
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    )
    .commit();
  return id;
}

// One batch — message create + conversation update (lastMessage/unreadCount)
// + notification create — instead of three sequential awaits, so a failure
// partway through can never leave the conversation preview or unread badge
// out of sync with the actual messages subcollection.
export async function sendMessage(convId, senderId, receiverId, body) {
  if (!db) throw new Error("Firebase is not configured.");
  const trimmed = (body || "").trim();
  if (!trimmed) throw new Error("Message cannot be empty.");

  const batch = writeBatch(db);
  const messageRef = doc(collection(db, "conversations", convId, "messages"));
  batch.set(messageRef, {
    senderId,
    receiverId,
    body: trimmed,
    createdAt: serverTimestamp(),
    readAt: null,
  });
  batch.update(doc(db, "conversations", convId), {
    lastMessage: trimmed,
    lastMessageAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    [`unreadCount.${receiverId}`]: increment(1),
  });
  batch.set(
    doc(collection(db, "notifications")),
    {
      userId: receiverId,
      type: "message",
      title: "New message",
      body: trimmed,
      entityId: messageRef.id,
      actionUrl: null,
      readAt: null,
      createdAt: serverTimestamp(),
    },
  );
  await batch.commit();
  return messageRef.id;
}

// Marks every unread message addressed to `myUid` in this conversation as
// read, and decrements (never hard-resets) the unread counter by the exact
// number transitioned — so a message arriving in the same instant can never
// be silently clobbered by an unconditional reset to 0.
export async function markConversationRead(convId, myUid) {
  if (!db || !convId || !myUid) return;
  const snapshot = await getDocs(
    query(
      collection(db, "conversations", convId, "messages"),
      where("receiverId", "==", myUid),
      where("readAt", "==", null),
    ),
  );
  if (snapshot.empty) return;

  const batch = writeBatch(db);
  snapshot.docs.forEach((docSnap) => batch.update(docSnap.ref, { readAt: serverTimestamp() }));
  batch.update(doc(db, "conversations", convId), {
    [`unreadCount.${myUid}`]: increment(-snapshot.size),
  });
  await batch.commit();
}
