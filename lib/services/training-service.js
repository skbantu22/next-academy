import { auth } from "../firebase";
async function request(options = {}) { const token = await auth?.currentUser?.getIdToken(); if (!token) throw new Error("Your session has expired. Please sign in again."); const response = await fetch("/api/admin/training", { ...options, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...options.headers } }); const payload = await response.json(); if (!response.ok) throw new Error(payload.message || "Unable to load training data. Please try again."); return payload; }
export const loadTraining = () => request();
export const createCourse = (course) => request({ method: "POST", body: JSON.stringify(course) });
export const updateCourse = (course) => request({ method: "PATCH", body: JSON.stringify(course) });
