import { auth } from "../firebase";
async function request(path, options = {}) { const token = await auth?.currentUser?.getIdToken(); if (!token) throw new Error("Your session has expired. Please sign in again."); const response = await fetch(path, { ...options, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...options.headers } }); const payload = await response.json(); if (!response.ok) throw new Error(payload.message || "Unable to complete the request. Please try again."); return payload; }
export const issueQrToken = (body) => request("/api/teacher/qr-token", { method: "POST", body: JSON.stringify(body) });
export const scanAttendanceQr = (body) => request("/api/teacher/attendance/scan", { method: "POST", body: JSON.stringify(body) });
