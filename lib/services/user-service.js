import { auth } from "../firebase";

async function userApi(options = {}) {
  const token = await auth?.currentUser?.getIdToken();
  if (!token) throw new Error("Your session has expired. Please sign in again.");
  const response = await fetch("/api/admin/users", {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.message || "Unable to load users. Please try again.");
  }
  return payload;
}

export const loadUsers = () => userApi();
export const changeUserRole = (uid, role) =>
  userApi({ method: "PATCH", body: JSON.stringify({ uid, role }) });
export const deleteUserAccount = (uid) =>
  userApi({ method: "DELETE", body: JSON.stringify({ uid }) });
