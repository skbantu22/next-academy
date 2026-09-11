import { auth } from "../firebase";

async function request(path = "", options = {}) {
  const token = await auth?.currentUser?.getIdToken();
  if (!token) throw new Error("Your session has expired. Please sign in again.");
  const response = await fetch(`/api/admin/teacher-assignments${path}`, {
    ...options,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || "Unable to manage teacher assignments.");
  return data;
}

export const loadTeacherAssignmentData = () => request();

// Legacy whole-array replace — still used by the AI assistant executor.
export const saveTeacherAssignment = (data) => request("", { method: "PATCH", body: JSON.stringify(data) });

// Single-teacher operations for the Teacher Assignment UI.
export const assignTeacher = ({ type, id, teacherId }) =>
  request("", { method: "PATCH", body: JSON.stringify({ type, id, action: "assign", teacherId }) });

export const removeTeacher = ({ type, id, teacherId }) =>
  request("", { method: "PATCH", body: JSON.stringify({ type, id, action: "remove", teacherId }) });
