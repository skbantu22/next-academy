import { auth } from "../firebase";
export async function studentApi(path = "", options = {}) {
  const token = await auth?.currentUser?.getIdToken();
  if (!token) throw new Error("Your session has expired. Please sign in again.");
  const response = await fetch(`/api/admin/students${path}`, { ...options, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...options.headers } });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.message || "Unable to load students.");
  return payload;
}
export async function loadStudentDirectory() { const [directory, courseData] = await Promise.all([studentApi(), studentApi("?resource=courses")]); return { students: directory.students || [], courses: courseData.courses || [] }; }
export const createStudent = (data) => studentApi("", { method: "POST", body: JSON.stringify(data) });
export const updateStudent = (data) => studentApi("", { method: "PATCH", body: JSON.stringify(data) });
