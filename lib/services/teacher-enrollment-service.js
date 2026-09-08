import { auth } from "../firebase";
async function request(path = "", options = {}) { const token = await auth?.currentUser?.getIdToken(); if (!token) throw new Error("Your session has expired. Please sign in again."); const response = await fetch(`/api/teacher/enrollments${path}`, { ...options, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...options.headers } }); const data = await response.json(); if (!response.ok) throw new Error(data.message || "Unable to manage enrollments."); return data; }
export const loadTeacherEnrollments = (courseId) => request(`?courseId=${encodeURIComponent(courseId)}`);
export const teacherEnrollStudent = (courseId, studentId) => request("", { method: "POST", body: JSON.stringify({ courseId, studentId }) });
