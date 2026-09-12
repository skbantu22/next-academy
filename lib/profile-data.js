"use client";

import { collection, doc, onSnapshot, query, updateDoc, where } from "firebase/firestore";
import { updateProfile as updateAuthProfile } from "firebase/auth";
import { getDownloadURL, ref as storageRef, uploadBytes } from "firebase/storage";
import { auth, db, storage } from "./firebase";

// Role-agnostic self-profile write — every field it's ever called with is
// one the Firestore rule's self-update guard already permits (it only
// blocks uid/role/teacherIds/active/qrVersion). Kept separate from
// lib/teacher-data.js's updateTeacherProfile so the still-working, still
// reachable /teacher/profile route is never touched by this change.
//
// Also mirrors displayName/photoURL onto the Firebase Auth user record
// itself (not just the Firestore doc) when they're part of this write —
// auth.currentUser.displayName/photoURL otherwise never change after
// signup, which is stale wherever something reads the raw Auth user
// instead of the Firestore profile (e.g. Firebase's own account picker,
// any future integration reading auth.currentUser directly). Best-effort:
// never blocks the real Firestore save if this secondary sync fails.
export async function updateMyProfile(uid, fields) {
  if (!db) throw new Error("Firebase is not configured.");
  await updateDoc(doc(db, "users", uid), fields);
  if (auth?.currentUser?.uid === uid && ("displayName" in fields || "photoURL" in fields)) {
    try {
      await updateAuthProfile(auth.currentUser, {
        ...("displayName" in fields ? { displayName: fields.displayName || null } : {}),
        ...("photoURL" in fields ? { photoURL: fields.photoURL || null } : {}),
      });
    } catch {
      // Non-fatal — the Firestore profile (the source of truth this app
      // actually reads everywhere) already saved successfully above.
    }
  }
}

// Direct profile-photo upload — same "upload the file to Firebase Storage,
// then save its download URL onto the doc" flow lib/teacher-training.js
// already uses for course thumbnails. Storage path users/{uid}/avatar/…
// is authorized purely by `request.auth.uid == uid` in storage.rules (no
// broken cross-service role lookup), so the client can upload directly.
export const MAX_AVATAR_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_AVATAR_TYPES = ["image/jpeg", "image/png", "image/webp"];

export function validateAvatarFile(file) {
  if (!file) return "Choose an image file.";
  if (!ALLOWED_AVATAR_TYPES.includes(file.type)) return "Use a JPG, PNG, or WEBP image.";
  if (file.size > MAX_AVATAR_BYTES) return "That image is too large — the limit is 5 MB.";
  return "";
}

export async function uploadProfilePhoto(uid, file) {
  if (!storage) throw new Error("File storage is not configured.");
  if (!uid) throw new Error("Your session has expired. Please sign in again.");
  const invalid = validateAvatarFile(file);
  if (invalid) throw new Error(invalid);
  const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const path = `users/${uid}/avatar/${Date.now()}.${ext}`;
  const objectRef = storageRef(storage, path);
  await uploadBytes(objectRef, file, { contentType: file.type });
  const photoURL = await getDownloadURL(objectRef);
  return { photoURL, photoPath: path };
}

function ordered(snapshot) {
  return snapshot.docs
    .map((item) => ({ id: item.id, ...item.data() }))
    .sort((a, b) => String(b.issueDate?.toMillis?.() || "").localeCompare(String(a.issueDate?.toMillis?.() || "")));
}

// First code to exercise the "read my own certificate" branch the
// certificates rule already grants (resource.data.studentId == auth.uid) —
// certificates are only ever issued by a Teacher to a Student, so this
// naturally returns empty for every non-Student role.
export function subscribeMyCertificates(uid, onData, onError) {
  if (!db || !uid) return () => {};
  return onSnapshot(
    query(collection(db, "certificates"), where("studentId", "==", uid)),
    (snapshot) => onData(ordered(snapshot)),
    (error) => onError?.(error),
  );
}
