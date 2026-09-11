"use client";

import { auth } from "./firebase";

// Uploads a .docx to the Admin-only parser and returns { html, text, warnings }.
// The file is never stored; nothing is written to the database here.
export async function parseWordDocument(file) {
  const token = await auth?.currentUser?.getIdToken();
  if (!token) throw new Error("Your session has expired. Please sign in again.");
  const form = new FormData();
  form.append("file", file);
  const response = await fetch("/api/admin/word-import", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || "Unable to read this Word document. Please upload a valid .docx file.");
  return data;
}
