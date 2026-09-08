import {
  collection,
  deleteDoc,
  doc,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import {
  deleteObject,
  getDownloadURL,
  ref as storageRef,
  uploadBytes,
} from "firebase/storage";
import { db, storage } from "./firebase";
import { subscribeTeacherCollection } from "./teacher-data";

export function subscribeTeacherDocuments(teacherId, onData, onError) {
  return subscribeTeacherCollection("documents", teacherId, onData, onError);
}

export async function uploadTeacherDocument(teacherId, file, meta = {}) {
  if (!db || !storage) throw new Error("Firebase is not configured.");
  const ref = doc(collection(db, "documents"));
  await setDoc(ref, {
    title: meta.title || file.name,
    description: meta.description || "",
    courseId: meta.courseId || "",
    teacherId,
    fileName: file.name,
    mimeType: file.type || "application/octet-stream",
    size: file.size,
    status: "uploading",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  try {
    const path = `documents/${ref.id}/${file.name}`;
    const objectRef = storageRef(storage, path);
    await uploadBytes(objectRef, file);
    const fileUrl = await getDownloadURL(objectRef);
    await updateDoc(ref, {
      status: "ready",
      storagePath: path,
      fileUrl,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    await updateDoc(ref, { status: "failed", updatedAt: serverTimestamp() });
    throw error;
  }
  return ref.id;
}

export async function deleteTeacherDocument(documentId, storagePath) {
  if (!db) throw new Error("Firebase is not configured.");
  if (storage && storagePath) {
    await deleteObject(storageRef(storage, storagePath)).catch(() => {});
  }
  await deleteDoc(doc(db, "documents", documentId));
}
