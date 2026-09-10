"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, UserPlus } from "lucide-react";
import { attendancePercent } from "../../lib/attendance";
import { stopEnterSubmit } from "../../lib/ui/keyboard";
import { capacityLabel, capacityRemainingLabel, isFull } from "../../lib/enrollment";
import { enrollStudent, loadEnrollments, unenrollStudent } from "../../lib/services/enrollment-service";
import { loadTeacherEnrollments, teacherEnrollStudent } from "../../lib/services/teacher-enrollment-service";
import { collectPayment, loadPaymentHistory } from "../../lib/services/payment-service";
import PaymentHistoryTable, { PaymentStatusBadge, formatMoney } from "./PaymentHistoryTable";

const formatDate = (value) => (value ? new Date(value).toLocaleDateString() : "—");
const paymentMethods = ["Cash", "Bank Transfer", "Card", "Other"];

function CapacityBar({ enrolledCount, capacity }) {
  const full = isFull(enrolledCount, capacity);
  const pct = capacity ? Math.min(100, Math.round((enrolledCount / capacity) * 100)) : 0;
  return (
    <div className="rounded-2xl bg-page p-4">
      <div className="flex items-center justify-between text-xs">
        <b className="text-sm text-ink">{capacityLabel(enrolledCount, capacity)}</b>
        <span className={`font-bold ${full ? "text-primary" : "text-success"}`}>
          {capacityRemainingLabel(enrolledCount, capacity)}
        </span>
      </div>
      {capacity != null && (
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-page">
          <div
            className={`h-full rounded-full ${full ? "bg-primary" : "bg-success"}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </div>
  );
}

function Dialog({ title, children, close }) {
  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === "Escape") close();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [close]);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 p-4" role="dialog" aria-modal="true">
      <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold">{title}</h3>
          <button type="button" onClick={close} className="text-xl text-muted" aria-label="Close">×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function EnrollStudentModal({ allStudents, capacityFull, onEnroll, close }) {
  const [search, setSearch] = useState("");
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");

  const filtered = allStudents.filter((student) =>
    `${student.displayName} ${student.email} ${student.userId}`.toLowerCase().includes(search.trim().toLowerCase()),
  );

  async function handleEnroll(student) {
    setBusyId(student.id);
    setError("");
    try {
      await onEnroll(student.id);
    } catch (err) {
      setError(err.message || "Unable to enroll this student.");
    } finally {
      setBusyId("");
    }
  }

  return (
    <Dialog title="Enroll Student" close={close}>
      {capacityFull && (
        <p className="mb-3 rounded-xl bg-active p-3 text-xs font-semibold text-primary">
          This training is full. No more students can be enrolled.
        </p>
      )}
      <label className="relative mb-3 block">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-subtle" />
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          onKeyDown={stopEnterSubmit}
          placeholder="Search by name, student ID, or email"
          className="w-full rounded-xl border border-border-subtle bg-page py-2 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-primary"
        />
      </label>
      {error && <p className="mb-3 rounded-xl bg-active p-3 text-xs text-primary">{error}</p>}
      <div className="max-h-80 space-y-2 overflow-y-auto">
        {filtered.length ? (
          filtered.map((student) => (
            <div key={student.id} className="flex items-center justify-between rounded-xl bg-page p-3 text-xs">
              <div className="min-w-0">
                <b className="block truncate">{student.displayName || "Unnamed student"}</b>
                <span className="text-muted">{student.userId} · {student.email}</span>
              </div>
              {student.alreadyEnrolled ? (
                <span className="shrink-0 rounded-full bg-page px-3 py-1.5 text-[10px] font-bold text-muted">Already Enrolled</span>
              ) : (
                <button
                  type="button"
                  onClick={() => handleEnroll(student)}
                  disabled={capacityFull || busyId === student.id}
                  className="shrink-0 rounded-full bg-primary px-3 py-1.5 text-[10px] font-bold text-white disabled:opacity-40"
                >
                  {busyId === student.id ? "Enrolling..." : "Enroll"}
                </button>
              )}
            </div>
          ))
        ) : (
          <p className="py-6 text-center text-sm text-muted">No matching students found.</p>
        )}
      </div>
    </Dialog>
  );
}

// Shown for both modes; the fee/payment section only renders when
// `showPayments` is true (mode="manage") — Teacher never sees it, and the
// data isn't even present on `student` for Teacher mode (stripped server-side).
function AdmissionDetailModal({ student, courseTitle, courseCode, showPayments, close }) {
  const [payments, setPayments] = useState([]);
  const [loadingPayments, setLoadingPayments] = useState(showPayments);
  const [historyError, setHistoryError] = useState("");

  useEffect(() => {
    if (!showPayments) return undefined;
    let cancelled = false;
    loadPaymentHistory(student.enrollmentId)
      .then((result) => {
        if (!cancelled) setPayments(result.payments);
      })
      .catch((err) => {
        if (!cancelled) setHistoryError(err.message || "Unable to load payment history.");
      })
      .finally(() => {
        if (!cancelled) setLoadingPayments(false);
      });
    return () => {
      cancelled = true;
    };
  }, [student.enrollmentId, showPayments]);

  return (
    <Dialog title="Admission Details" close={close}>
      <dl className="grid gap-3 text-sm">
        <div><dt className="text-xs text-subtle">User ID</dt><dd>{student.userId}</dd></div>
        <div><dt className="text-xs text-subtle">Name</dt><dd>{student.displayName || "—"}</dd></div>
        <div><dt className="text-xs text-subtle">Email</dt><dd>{student.email || "—"}</dd></div>
        <div><dt className="text-xs text-subtle">Phone</dt><dd>{student.phone || "—"}</dd></div>
        <div><dt className="text-xs text-subtle">Admission Date</dt><dd>{formatDate(student.enrolledAt)}</dd></div>
        {student.attendance != null && (
          <div><dt className="text-xs text-subtle">Attendance</dt><dd>{student.attendance}%</dd></div>
        )}
      </dl>

      {showPayments && (
        <>
          <div className="mt-5 grid grid-cols-2 gap-3 rounded-2xl bg-page p-4 sm:grid-cols-4">
            <div><p className="text-[10px] font-bold uppercase text-subtle">Total Fee</p><p className="mt-1 text-sm font-bold text-ink">{formatMoney(student.finalFee)}</p></div>
            <div><p className="text-[10px] font-bold uppercase text-subtle">Paid</p><p className="mt-1 text-sm font-bold text-success">{formatMoney(student.totalPaid)}</p></div>
            <div><p className="text-[10px] font-bold uppercase text-subtle">Due</p><p className="mt-1 text-sm font-bold text-primary">{formatMoney(student.dueAmount)}</p></div>
            <div><p className="text-[10px] font-bold uppercase text-subtle">Status</p><p className="mt-1"><PaymentStatusBadge value={student.paymentStatus} /></p></div>
          </div>
          <p className="mb-2 mt-5 text-xs font-bold uppercase tracking-wider text-subtle">Payment History</p>
          {loadingPayments ? (
            <p className="py-6 text-center text-sm text-muted">Loading payment history...</p>
          ) : historyError ? (
            <p className="rounded-xl bg-active p-3 text-xs text-primary">{historyError}</p>
          ) : (
            <PaymentHistoryTable
              payments={payments}
              studentName={student.displayName || student.email}
              courseTitle={courseTitle}
              courseCode={courseCode}
              finalFee={student.finalFee}
            />
          )}
        </>
      )}
    </Dialog>
  );
}

// mode="manage" only. Collecting a payment always uses the caller's live
// student.dueAmount/finalFee/totalPaid as read when the modal was opened;
// the actual authoritative check happens server-side in a transaction
// (lib/server/payment-core.js) so a stale due here can never overpay.
function CollectPaymentModal({ student, courseTitle, onCollected, close }) {
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("Cash");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const due = student.dueAmount;
  const amountNum = amount === "" ? null : Number(amount);
  const amountError =
    amountNum !== null && amountNum <= 0
      ? "Payment amount must be greater than zero."
      : amountNum !== null && amountNum > due
        ? "Payment amount cannot be greater than the outstanding due."
        : null;

  async function submit(event) {
    event.preventDefault();
    if (saving || due <= 0) return;
    if (amountNum === null || amountError) {
      setError(amountError || "Enter a payment amount.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await onCollected({ amount: amountNum, paymentMethod: method, paymentDate: date, reference, notes });
      close();
    } catch (err) {
      setError(err.message || "Unable to save payment.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog title="Collect Payment" close={close}>
      <form onSubmit={submit} className="space-y-4">
        <div className="text-xs text-muted">
          <p><b className="text-ink">Student:</b> {student.displayName || student.email}</p>
          <p><b className="text-ink">Training:</b> {courseTitle}</p>
        </div>
        <div className="grid grid-cols-3 gap-3 rounded-2xl bg-page p-3 text-center">
          <div><p className="text-[10px] font-bold uppercase text-subtle">Total Fee</p><p className="mt-1 text-sm font-bold text-ink">{formatMoney(student.finalFee)}</p></div>
          <div><p className="text-[10px] font-bold uppercase text-subtle">Total Paid</p><p className="mt-1 text-sm font-bold text-success">{formatMoney(student.totalPaid)}</p></div>
          <div><p className="text-[10px] font-bold uppercase text-subtle">Current Due</p><p className="mt-1 text-sm font-bold text-primary">{formatMoney(due)}</p></div>
        </div>

        {due <= 0 ? (
          <p className="rounded-xl bg-success-soft p-3 text-xs font-semibold text-success">This admission is already fully paid.</p>
        ) : (
          <>
            <label className="grid gap-1 text-xs font-bold text-muted">
              Payment Amount
              <span className="relative block">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-subtle">S$</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  onKeyDown={stopEnterSubmit}
                  className={`w-full rounded-xl border px-3 py-2.5 pl-8 text-sm outline-none focus:ring-2 focus:ring-primary ${amountError ? "border-primary" : "border-border-subtle"}`}
                />
              </span>
              {amountError && <span className="text-[11px] font-semibold text-primary">{amountError}</span>}
            </label>
            <label className="grid gap-1 text-xs font-bold text-muted">
              Payment Method
              <select value={method} onChange={(event) => setMethod(event.target.value)} className="rounded-xl border border-border-subtle px-3 py-2.5 text-sm">
                {paymentMethods.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </label>
            <label className="grid gap-1 text-xs font-bold text-muted">
              Payment Date
              <input type="date" value={date} onChange={(event) => setDate(event.target.value)} onKeyDown={stopEnterSubmit} className="rounded-xl border border-border-subtle px-3 py-2.5 text-sm" />
            </label>
            <label className="grid gap-1 text-xs font-bold text-muted">
              Reference / Receipt No. (optional)
              <input value={reference} onChange={(event) => setReference(event.target.value)} onKeyDown={stopEnterSubmit} className="rounded-xl border border-border-subtle px-3 py-2.5 text-sm font-normal" />
            </label>
            <label className="grid gap-1 text-xs font-bold text-muted">
              Notes (optional)
              <textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={2} className="rounded-xl border border-border-subtle px-3 py-2.5 text-sm font-normal" />
            </label>
          </>
        )}

        {error && <p className="rounded-xl bg-active p-3 text-xs text-primary">{error}</p>}

        <div className="flex justify-end gap-3">
          <button type="button" onClick={close} disabled={saving} className="px-4 py-2 text-sm font-bold text-muted">
            Cancel
          </button>
          {due > 0 && (
            <button disabled={saving || Boolean(amountError)} className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white disabled:opacity-60">
              {saving ? "Saving..." : "Save Payment"}
            </button>
          )}
        </div>
      </form>
    </Dialog>
  );
}

const backends = {
  manage: { load: loadEnrollments, enroll: enrollStudent, canRemove: true, canManagePayments: true },
  teacher: { load: loadTeacherEnrollments, enroll: teacherEnrollStudent, canRemove: false, canManagePayments: false },
};

// mode="manage": Director/Admin — full CRUD via /api/admin/enrollments.
// mode="teacher": the training's assigned Teacher (primary or assistant) —
// can view + enroll via /api/teacher/enrollments, which independently
// re-verifies the teacher is assigned before touching anything; no Remove
// action is ever rendered or reachable in this mode.
// `attendance` (optional): raw attendance records from the caller's existing
// data (both TrainingDetailsPage roles already load this safely) — when
// provided, an Attendance % column is shown.
export default function EnrollmentManager({ mode, courseId, courseTitle, courseCode, attendance, classroomInfo }) {
  const backend = backends[mode] || backends.manage;
  const [data, setData] = useState({ enrollments: [], allStudents: [], enrolledCount: 0, capacity: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [viewing, setViewing] = useState(null);
  const [collectingFor, setCollectingFor] = useState(null);
  const [message, setMessage] = useState("");

  const load = () => {
    if (!courseId) return;
    backend
      .load(courseId)
      .then((result) => {
        setData(result);
        setError("");
      })
      .catch((err) => setError(err.message || "Unable to load enrolled students."));
  };
  useEffect(() => {
    if (!courseId) return undefined;
    let cancelled = false;
    backend
      .load(courseId)
      .then((result) => {
        if (!cancelled) {
          setData(result);
          setError("");
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || "Unable to load enrolled students.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [courseId, mode]); // eslint-disable-line react-hooks/exhaustive-deps

  const rows = useMemo(
    () =>
      data.enrollments.map((item) => ({
        ...item,
        attendance: attendance ? attendancePercent(attendance.filter((record) => record.studentId === item.studentId)) : null,
      })),
    [data.enrollments, attendance],
  );

  const enrolledCount = data.enrolledCount;
  const capacity = data.capacity;
  const full = isFull(enrolledCount, capacity);

  const filteredRows = rows.filter((row) =>
    `${row.displayName} ${row.email} ${row.userId}`.toLowerCase().includes(search.trim().toLowerCase()),
  );

  async function handleEnroll(studentId) {
    await backend.enroll(courseId, studentId);
    setMessage("Student enrolled.");
    setModalOpen(false);
    load();
  }
  async function handleRemove(row) {
    if (!window.confirm(`Remove ${row.displayName || "this student"} from this training?`)) return;
    setMessage("");
    try {
      await unenrollStudent(courseId, row.studentId);
      setMessage("Student removed.");
      load();
    } catch (err) {
      setError(err.message || "Unable to remove this student.");
    }
  }
  async function handleCollectPayment(row, payment) {
    await collectPayment(courseId, row.studentId, payment);
    setMessage("Payment saved.");
    load();
  }

  return (
    <div className="space-y-4">
      {classroomInfo && (
        <div className="rounded-2xl bg-page p-3 text-xs text-muted">
          {[classroomInfo.campus, classroomInfo.building, classroomInfo.floor, classroomInfo.room, classroomInfo.batchName]
            .filter(Boolean)
            .join(" · ") || "Physical classroom details not set."}
          {classroomInfo.schedule && <span className="ml-2">· {classroomInfo.schedule}</span>}
        </div>
      )}

      <CapacityBar enrolledCount={enrolledCount} capacity={capacity} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="relative min-w-56 flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-subtle" />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            onKeyDown={stopEnterSubmit}
            placeholder="Search by name, student ID, or email"
            className="w-full rounded-xl border border-border-subtle bg-page py-2 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-primary"
          />
        </label>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          disabled={full}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-xs font-bold text-white disabled:opacity-40"
        >
          <UserPlus className="h-3.5 w-3.5" /> Enroll Student
        </button>
      </div>
      {full && <p className="text-xs font-semibold text-primary">This training is full. No more students can be enrolled.</p>}

      {message && <p className="rounded-xl bg-success-soft p-3 text-xs text-success">{message}</p>}
      {error && <p className="rounded-xl bg-active p-3 text-xs text-primary">{error}</p>}

      {loading ? (
        <p className="py-8 text-center text-sm text-muted">Loading enrolled students...</p>
      ) : filteredRows.length ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b text-[10px] uppercase tracking-wider text-subtle">
              <tr>
                {[
                  "User ID",
                  "Name",
                  "Email",
                  "Phone",
                  "Enrollment Date",
                  ...(attendance ? ["Attendance"] : []),
                  ...(backend.canManagePayments ? ["Total Fee", "Paid", "Due", "Payment Status"] : []),
                  "Status",
                  "Actions",
                ].map((label) => (
                  <th key={label} className="p-3">{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row) => (
                <tr key={row.studentId} className="border-b border-border-subtle">
                  <td className="p-3 font-mono text-xs">{row.userId}</td>
                  <td className="p-3"><b>{row.displayName || "Unnamed student"}</b></td>
                  <td className="p-3 text-xs text-muted">{row.email}</td>
                  <td className="p-3 text-xs text-muted">{row.phone || "—"}</td>
                  <td className="p-3 text-xs text-muted">{formatDate(row.enrolledAt)}</td>
                  {attendance && <td className="p-3 text-xs">{row.attendance == null ? "—" : `${row.attendance}%`}</td>}
                  {backend.canManagePayments && (
                    <>
                      <td className="p-3 text-xs font-bold text-ink">{formatMoney(row.finalFee)}</td>
                      <td className="p-3 text-xs font-bold text-success">{formatMoney(row.totalPaid)}</td>
                      <td className="p-3 text-xs font-bold text-primary">{formatMoney(row.dueAmount)}</td>
                      <td className="p-3"><PaymentStatusBadge value={row.paymentStatus} /></td>
                    </>
                  )}
                  <td className="p-3"><span className="rounded-full bg-success-soft px-2.5 py-1 text-[10px] font-bold text-success">Active</span></td>
                  <td className="space-x-3 p-3 text-xs font-bold">
                    <button type="button" onClick={() => setViewing(row)} className="text-muted">View</button>
                    {backend.canManagePayments && (
                      <button type="button" onClick={() => setCollectingFor(row)} className="text-primary">Collect Payment</button>
                    )}
                    {backend.canRemove && (
                      <button type="button" onClick={() => handleRemove(row)} className="text-primary">Remove</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="py-8 text-center text-sm text-muted">No students enrolled yet.</p>
      )}

      {modalOpen && (
        <EnrollStudentModal
          allStudents={data.allStudents}
          capacityFull={full}
          onEnroll={handleEnroll}
          close={() => setModalOpen(false)}
        />
      )}
      {viewing && (
        <AdmissionDetailModal
          student={viewing}
          courseTitle={courseTitle}
          courseCode={courseCode}
          showPayments={backend.canManagePayments}
          close={() => setViewing(null)}
        />
      )}
      {collectingFor && (
        <CollectPaymentModal
          student={collectingFor}
          courseTitle={courseTitle}
          onCollected={(payment) => handleCollectPayment(collectingFor, payment)}
          close={() => setCollectingFor(null)}
        />
      )}
    </div>
  );
}
