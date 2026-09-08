import { FieldValue } from "firebase-admin/firestore";
import { listAdmissions } from "./payment-core";

const plain = (snapshot) => ({ id: snapshot.id, ...snapshot.data() });
const date = (value) => (value?.toDate ? value.toDate().toISOString() : typeof value === "string" ? value : null);

export const expenseCategories = [
  "Rent",
  "Salary",
  "Utilities",
  "Equipment",
  "Marketing",
  "Transport",
  "Maintenance",
  "Software",
  "Training Materials",
  "Other",
];
const paymentMethods = new Set(["Cash", "Bank Transfer", "Card", "Other"]);

async function resolveUserNames(db, uids) {
  const unique = [...new Set(uids.filter(Boolean))];
  if (!unique.length) return new Map();
  const docs = await db.getAll(...unique.map((id) => db.collection("users").doc(id)));
  return new Map(
    docs.map((snapshot) => [snapshot.id, snapshot.exists ? snapshot.data().displayName || snapshot.data().email || snapshot.id : snapshot.id]),
  );
}

function inRange(isoDate, from, to) {
  if (!isoDate) return !from && !to;
  if (from && isoDate < from) return false;
  if (to && isoDate > to) return false;
  return true;
}

// System-wide, flat payment list (not scoped to one training) — the data
// source for the Income/Payments tab, Transactions, and Profit & Loss.
// Reuses the exact same `payments` collection lib/server/payment-core.js
// already writes to; nothing new is stored here.
export async function listAllPayments(db, { from, to } = {}) {
  const snapshot = await db.collection("payments").get();
  const rows = snapshot.docs.map(plain).map((item) => ({ ...item, paymentDate: item.paymentDate || date(item.createdAt), createdAt: date(item.createdAt) }));
  const filtered = from || to ? rows.filter((item) => inRange(item.paymentDate, from, to)) : rows;

  const courseIds = [...new Set(filtered.map((item) => item.courseId))];
  const studentIds = [...new Set(filtered.map((item) => item.studentId))];
  const creatorIds = [...new Set(filtered.map((item) => item.createdBy))];
  const enrollmentIds = [...new Set(filtered.map((item) => item.enrollmentId).filter(Boolean))];
  const [courseDocs, studentDocs, creatorNames, enrollmentDocs] = await Promise.all([
    courseIds.length ? db.getAll(...courseIds.map((id) => db.collection("courses").doc(id))) : [],
    studentIds.length ? db.getAll(...studentIds.map((id) => db.collection("users").doc(id))) : [],
    resolveUserNames(db, creatorIds),
    enrollmentIds.length ? db.getAll(...enrollmentIds.map((id) => db.collection("enrollments").doc(id))) : [],
  ]);
  const courseMap = new Map(courseDocs.filter((d) => d.exists).map((d) => [d.id, plain(d)]));
  const studentMap = new Map(studentDocs.filter((d) => d.exists).map((d) => [d.id, plain(d)]));
  const enrollmentMap = new Map(enrollmentDocs.filter((d) => d.exists).map((d) => [d.id, plain(d)]));

  return filtered
    .map((item) => {
      const course = courseMap.get(item.courseId);
      const student = studentMap.get(item.studentId);
      return {
        ...item,
        courseTitle: course?.title || "Untitled training",
        courseCode: course?.courseCode || item.courseId,
        studentName: student?.displayName || student?.email || "Unknown student",
        studentCode: student?.studentId || "—",
        recordedByName: creatorNames.get(item.createdBy) || item.createdBy,
        finalFee: Number(enrollmentMap.get(item.enrollmentId)?.finalFee) || 0,
      };
    })
    .sort((left, right) => (right.paymentDate || "").localeCompare(left.paymentDate || "") || (right.createdAt || "").localeCompare(left.createdAt || ""));
}

export async function listExpenses(db, { from, to } = {}) {
  const snapshot = await db.collection("expenses").get();
  const rows = snapshot.docs.map(plain).map((item) => ({ ...item, expenseDate: item.expenseDate || date(item.createdAt), createdAt: date(item.createdAt) }));
  const filtered = from || to ? rows.filter((item) => inRange(item.expenseDate, from, to)) : rows;
  const creatorNames = await resolveUserNames(db, filtered.map((item) => item.createdBy));
  return filtered
    .map((item) => ({ ...item, recordedByName: creatorNames.get(item.createdBy) || item.createdBy }))
    .sort((left, right) => (right.expenseDate || "").localeCompare(left.expenseDate || "") || (right.createdAt || "").localeCompare(left.createdAt || ""));
}

function validateExpenseInput(body) {
  const amount = Number(body.amount);
  if (!Number.isFinite(amount) || amount <= 0) throw Object.assign(new Error("Expense amount must be greater than zero."), { statusCode: 400 });
  const category = typeof body.category === "string" ? body.category.trim() : "";
  if (!category) throw Object.assign(new Error("Choose an expense category."), { statusCode: 400 });
  const paymentMethod = typeof body.paymentMethod === "string" ? body.paymentMethod : "";
  if (!paymentMethods.has(paymentMethod)) throw Object.assign(new Error("Choose a valid payment method."), { statusCode: 400 });
  const expenseDate = typeof body.expenseDate === "string" && body.expenseDate ? body.expenseDate : "";
  if (!expenseDate) throw Object.assign(new Error("Expense date is required."), { statusCode: 400 });
  return {
    amount,
    currency: "SGD",
    category,
    paymentMethod,
    expenseDate,
    description: typeof body.description === "string" ? body.description.trim().slice(0, 500) : "",
    reference: typeof body.reference === "string" ? body.reference.trim().slice(0, 120) : "",
  };
}

export async function recordExpense(db, body, createdBy) {
  try {
    const fields = validateExpenseInput(body);
    const ref = await db.collection("expenses").add({
      ...fields,
      status: "Recorded",
      createdBy,
      createdAt: FieldValue.serverTimestamp(),
    });
    return { status: 201, body: { ok: true, id: ref.id } };
  } catch (error) {
    if (error.statusCode) return { status: error.statusCode, body: { message: error.message } };
    throw error;
  }
}

export async function updateExpense(db, id, body) {
  const ref = db.collection("expenses").doc(id);
  const snapshot = await ref.get();
  if (!snapshot.exists) return { status: 404, body: { message: "Expense not found." } };
  try {
    const fields = validateExpenseInput(body);
    await ref.update({ ...fields, updatedAt: FieldValue.serverTimestamp() });
    return { status: 200, body: { ok: true } };
  } catch (error) {
    if (error.statusCode) return { status: error.statusCode, body: { message: error.message } };
    throw error;
  }
}

export async function deleteExpense(db, id) {
  const ref = db.collection("expenses").doc(id);
  const snapshot = await ref.get();
  if (!snapshot.exists) return { status: 404, body: { message: "Expense not found." } };
  await ref.delete();
  return { status: 200, body: { ok: true } };
}

// Single source of truth for every number the Finance module shows — the
// Dashboard, Transactions, and Profit & Loss pages all call this same
// function (optionally date-scoped) instead of recomputing totals their
// own way, per the "one consistent calculation" requirement.
export async function buildFinanceOverview(db, { from, to } = {}) {
  const [admissions, payments, expenses] = await Promise.all([
    listAdmissions(db),
    listAllPayments(db, { from, to }),
    listExpenses(db, { from, to }),
  ]);

  // Outstanding due is a current-state snapshot (not date-ranged) — it
  // doesn't make sense to ask "what was due between two dates."
  const totalDue = admissions.reduce((sum, item) => sum + (Number(item.dueAmount) || 0), 0);
  const totalIncome = payments.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  const totalExpenses = expenses.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);

  return {
    admissions,
    payments,
    expenses,
    totals: {
      income: totalIncome,
      due: totalDue,
      expenses: totalExpenses,
      netProfit: totalIncome - totalExpenses,
      paidCount: admissions.filter((item) => item.paymentStatus === "Paid").length,
      partialCount: admissions.filter((item) => item.paymentStatus === "Partial").length,
      unpaidCount: admissions.filter((item) => item.paymentStatus === "Unpaid").length,
    },
  };
}
