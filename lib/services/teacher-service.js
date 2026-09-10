import { auth } from "../firebase";

async function request(options = {}) {
  const token = await auth?.currentUser?.getIdToken();
  if (!token) throw new Error("Your session has expired. Please sign in again.");
  const response = await fetch("/api/admin/teachers", { ...options, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...options.headers } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || "Unable to create this teacher account.");
  return data;
}

export const createTeacher = (data) => request({ method: "POST", body: JSON.stringify(data) });
