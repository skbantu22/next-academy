import { auth } from "../firebase";
async function request(path = "", options = {}) {
  const token = await auth?.currentUser?.getIdToken();
  if (!token) throw new Error("Your session has expired. Please sign in again.");
  const response = await fetch(`/api/admin/payments${path}`, {
    ...options,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...options.headers },
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || "Unable to manage payments.");
  return data;
}
export const loadPaymentHistory = (enrollmentId) => request(`?enrollmentId=${encodeURIComponent(enrollmentId)}`);
export const collectPayment = (courseId, studentId, payment) =>
  request("", { method: "POST", body: JSON.stringify({ courseId, studentId, ...payment }) });

export async function loadAdmissions() {
  const token = await auth?.currentUser?.getIdToken();
  if (!token) throw new Error("Your session has expired. Please sign in again.");
  const response = await fetch("/api/admin/admissions", { headers: { Authorization: `Bearer ${token}` } });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || "Unable to load admissions.");
  return data;
}
