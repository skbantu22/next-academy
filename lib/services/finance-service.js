import { auth } from "../firebase";
async function request(url, options = {}) {
  const token = await auth?.currentUser?.getIdToken();
  if (!token) throw new Error("Your session has expired. Please sign in again.");
  const response = await fetch(url, {
    ...options,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...options.headers },
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || "Unable to complete this request.");
  return data;
}

export const loadFinanceOverview = (range = {}) => {
  const params = new URLSearchParams();
  if (range.from) params.set("from", range.from);
  if (range.to) params.set("to", range.to);
  const query = params.toString();
  return request(`/api/admin/finance${query ? `?${query}` : ""}`);
};

export const loadExpenses = (range = {}) => {
  const params = new URLSearchParams();
  if (range.from) params.set("from", range.from);
  if (range.to) params.set("to", range.to);
  const query = params.toString();
  return request(`/api/admin/expenses${query ? `?${query}` : ""}`);
};
export const createExpense = (expense) => request("/api/admin/expenses", { method: "POST", body: JSON.stringify(expense) });
export const updateExpense = (id, expense) => request("/api/admin/expenses", { method: "PATCH", body: JSON.stringify({ id, ...expense }) });
export const deleteExpense = (id) => request("/api/admin/expenses", { method: "DELETE", body: JSON.stringify({ id }) });
