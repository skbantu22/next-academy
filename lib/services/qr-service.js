import { auth } from "../firebase";

// A request failure the UI can branch on instead of surfacing a raw,
// browser-specific `fetch` error string. `code`:
//   "auth"    – not signed in / token rejected (401/403)
//   "network" – the request never reached the server (offline, DNS,
//               cellular drop, captive portal, CORS). Browsers word this
//               inconsistently ("Failed to fetch" / "Load failed" /
//               "NetworkError…") so callers translate it themselves and
//               may fall back to a locally cached copy.
//   "server"  – the server answered with a non-2xx status
export class QrRequestError extends Error {
  constructor(message, { code, status, cause } = {}) {
    super(message);
    this.name = "QrRequestError";
    this.code = code || "unknown";
    this.status = status;
    if (cause) this.cause = cause;
  }
}

async function request(path, options = {}) {
  let token = null;
  if (auth?.currentUser) {
    try {
      token = await auth.currentUser.getIdToken();
    } catch (tokenError) {
      // A token refresh needs the network too — on mobile this fails for
      // the same reasons the request itself would, so treat it the same.
      console.error(`[qr-service] getIdToken failed before ${path}`, tokenError);
      throw new QrRequestError("Could not reach the server.", { code: "network", cause: tokenError });
    }
  }
  if (!token) throw new QrRequestError("Your session has expired. Please sign in again.", { code: "auth" });

  let response;
  try {
    response = await fetch(path, {
      ...options,
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...options.headers },
    });
  } catch (networkError) {
    console.error(`[qr-service] network failure calling ${path}`, networkError);
    throw new QrRequestError("Could not reach the server.", { code: "network", cause: networkError });
  }

  let payload = {};
  try {
    payload = await response.json();
  } catch {
    payload = {};
  }
  if (!response.ok) {
    throw new QrRequestError(payload.message || "Unable to complete the request. Please try again.", {
      code: response.status === 401 || response.status === 403 ? "auth" : "server",
      status: response.status,
    });
  }
  return payload;
}

export const issueQrToken = (body) => request("/api/teacher/qr-token", { method: "POST", body: JSON.stringify(body) });
export const scanAttendanceQr = (body) => request("/api/teacher/attendance/scan", { method: "POST", body: JSON.stringify(body) });

// The student self-service side of the automatic QR attendance system
// (see app/api/attendance/session-checkin). Deliberately does NOT reuse
// the generic `request()` above — that throws a plain Error on any non-OK
// status, discarding the response body's `code` field the scanner UI needs
// to tell "expired" apart from "not_enrolled" apart from "already marked",
// etc. This returns the full parsed response regardless of status (as long
// as the server actually answered), and only throws for a real network
// failure.
export async function checkInSession(sessionToken) {
  const authToken = await auth?.currentUser?.getIdToken();
  if (!authToken) throw new Error("Your session has expired. Please sign in again.");
  const response = await fetch("/api/attendance/session-checkin", {
    method: "POST",
    headers: { Authorization: `Bearer ${authToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ token: sessionToken }),
  });
  return response.json();
}
