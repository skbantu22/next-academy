import { auth } from "../firebase";

async function request(options = {}) {
  const token = await auth?.currentUser?.getIdToken();
  if (!token) throw new Error("Your session has expired. Please sign in again.");
  const response = await fetch("/api/ai-assistant/audit", { ...options, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...options.headers } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || "Unable to complete this request.");
  return data;
}

export const logAiAction = (entry) => request({ method: "POST", body: JSON.stringify(entry) });
export const loadAiAuditLog = () => request();
