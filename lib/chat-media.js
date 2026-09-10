"use client";

import { deleteObject, getDownloadURL, ref as storageRef, uploadBytesResumable } from "firebase/storage";
import { storage } from "./firebase";

// Client-side backstop matching the Storage rule's hard 100MB cap — these
// tighter, type-specific limits exist purely to fail fast with a friendly
// message before ever starting an upload.
const LIMITS = {
  image: 10 * 1024 * 1024,
  audio: 20 * 1024 * 1024,
  video: 100 * 1024 * 1024,
};

const ACCEPTED = {
  image: /^image\//,
  audio: /^audio\//,
  video: /^video\//,
};

export function validateChatFile(file, kind) {
  if (!file) return "No file selected.";
  if (!ACCEPTED[kind]?.test(file.type)) return "This file type isn't supported.";
  if (file.size > LIMITS[kind]) {
    return `This file is too large. Maximum size is ${Math.round(LIMITS[kind] / (1024 * 1024))} MB.`;
  }
  return null;
}

// Reads real video duration client-side before upload (no server round trip
// needed) by loading the file into a throwaway, never-attached <video>.
export function readMediaDuration(file) {
  return new Promise((resolve) => {
    const el = document.createElement(file.type.startsWith("video") ? "video" : "audio");
    const url = URL.createObjectURL(file);
    el.preload = "metadata";
    el.src = url;
    el.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve(Number.isFinite(el.duration) ? Math.round(el.duration) : null);
    };
    el.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
  });
}

// Never creates a Firestore message doc itself — the caller only does that
// after this resolves, so a failed/cancelled upload can never leave behind
// a message pointing at a broken or empty fileUrl.
export function uploadChatMedia(conversationId, messageId, file, onProgress) {
  if (!storage) return Promise.reject(new Error("Firebase Storage is not configured."));
  const storagePath = `chat/${conversationId}/${messageId}/${file.name}`;
  const objectRef = storageRef(storage, storagePath);
  const task = uploadBytesResumable(objectRef, file, { contentType: file.type });

  const promise = new Promise((resolve, reject) => {
    task.on(
      "state_changed",
      (snapshot) => onProgress?.(Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100)),
      (error) => reject(error),
      async () => {
        try {
          const fileUrl = await getDownloadURL(objectRef);
          resolve({ fileUrl, storagePath });
        } catch (error) {
          reject(error);
        }
      },
    );
  });
  promise.cancel = () => task.cancel();
  return promise;
}

export async function deleteChatMedia(storagePath) {
  if (!storage || !storagePath) return;
  try {
    await deleteObject(storageRef(storage, storagePath));
  } catch {
    // Non-fatal — same convention as lib/teacher-documents.js: a missing or
    // already-deleted Storage object should never block deleting the
    // Firestore record that pointed at it.
  }
}

// Maps known Firebase/browser errors to friendly text — raw error codes
// are never shown to end users.
export function chatMediaErrorMessage(error) {
  const code = error?.code || "";
  if (code === "storage/unauthorized") return "You don't have permission to upload here.";
  if (code === "storage/canceled") return "Upload cancelled.";
  if (code === "storage/quota-exceeded") return "Storage limit reached. Please contact support.";
  if (code === "storage/retry-limit-exceeded") return "Network error. Please check your connection and try again.";
  if (code === "permission-denied") return "You don't have permission to do that.";
  return "Something went wrong. Please try again.";
}
