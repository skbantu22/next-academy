"use client";

import { useEffect, useState } from "react";
import { addDoc, collection, doc, onSnapshot, query, serverTimestamp, updateDoc, where } from "firebase/firestore";
import { db } from "./firebase";

// Public landing-page contact form → Director/Admin dashboard pipeline.
// Firestore is the source of truth throughout (no localStorage, no
// hardcoded counts) — see firestore.rules' contactInquiries block for the
// exact shape a public, signed-out visitor is allowed to write, and why
// only admin() (Admin/Director) can read the list or change status.

// Called directly from the public site (no auth required — the visitor may
// be signed out). Throws on failure so the caller's catch block can show an
// error notification without clearing what they typed.
export async function submitContactInquiry({ name, email, role, topic, message }) {
  if (!db) throw new Error("This form isn't available right now. Please try again later.");
  await addDoc(collection(db, "contactInquiries"), {
    name: name.trim(),
    email: email.trim(),
    role: role || "",
    topic: topic || "",
    message: message.trim(),
    status: "new",
    createdAt: serverTimestamp(),
    readAt: null,
    repliedAt: null,
    closedAt: null,
  });
}

function ordered(snapshot) {
  return snapshot.docs
    .map((item) => ({ id: item.id, ...item.data() }))
    .sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
}

// Full live list for the Director/Admin "Contact Inquiries" page.
export function subscribeInquiries(onData, onError) {
  if (!db) return () => {};
  return onSnapshot(
    collection(db, "contactInquiries"),
    (snapshot) => onData(ordered(snapshot)),
    (error) => onError?.(error),
  );
}

// Live "new" count only — used for the sidebar badge so it never has to
// load the full inquiry list just to show a number.
export function subscribeNewInquiryCount(onCount, onError) {
  if (!db) return () => {};
  return onSnapshot(
    query(collection(db, "contactInquiries"), where("status", "==", "new")),
    (snapshot) => onCount(snapshot.size),
    (error) => onError?.(error),
  );
}

const STATUS_TIMESTAMP_FIELD = { read: "readAt", replied: "repliedAt", closed: "closedAt" };

export async function updateInquiryStatus(id, status) {
  if (!db) return;
  const field = STATUS_TIMESTAMP_FIELD[status];
  await updateDoc(doc(db, "contactInquiries", id), {
    status,
    ...(field ? { [field]: serverTimestamp() } : {}),
  });
}

// Mirrors ChatButton.jsx's useUnreadConversationCount — a live count for a
// sidebar badge. `enabled` lets non-Director/Admin dashboards skip
// subscribing entirely (they'd be denied by firestore.rules anyway; this
// just avoids the console noise from an unnecessary permission-denied
// listener on every other role's dashboard).
export function useNewInquiryCount(enabled = true) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!enabled) return undefined;
    return subscribeNewInquiryCount(setCount, () => {});
  }, [enabled]);
  return count;
}
