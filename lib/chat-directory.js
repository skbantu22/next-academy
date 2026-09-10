import { auth } from "./firebase";

export async function loadChatDirectory() {
  const token = await auth?.currentUser?.getIdToken();
  if (!token) throw new Error("Your session has expired. Please sign in again.");
  const response = await fetch("/api/chat/directory", { headers: { Authorization: `Bearer ${token}` } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || "Unable to load the user directory.");
  return data.users || [];
}

export async function uploadGroupPhoto(conversationId, file) {
  const token = await auth?.currentUser?.getIdToken();
  if (!token) throw new Error("Your session has expired. Please sign in again.");
  const form = new FormData();
  form.set("conversationId", conversationId);
  form.set("file", file);
  const response = await fetch("/api/chat/group-photo", { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: form });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || "Unable to upload the group photo.");
  return data.photoUrl;
}
