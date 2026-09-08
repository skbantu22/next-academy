"use client";

import { useEffect, useState } from "react";
import { useAuth } from "../../lib/auth-context";
import { subscribeMyEnrollments, subscribeMyPayments } from "../../lib/student-data";
import PaymentHistoryTable, { PaymentStatusBadge, formatMoney } from "../training/PaymentHistoryTable";

// Read-only by design: a Student can view their own admission/payment
// summary and history, but there is no edit/delete affordance anywhere in
// this component — collecting or changing a payment only ever happens
// through Director/Admin's EnrollmentManager, enforced server-side by the
// /api/admin/payments route and by Firestore rules (payments: write: admin()).
export default function MyPaymentSummary() {
  const { user } = useAuth();
  const [enrollments, setEnrollments] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    if (!user?.uid) return undefined;
    const unsubEnrollments = subscribeMyEnrollments(
      user.uid,
      (rows) => {
        setEnrollments(rows);
        setLoading(false);
      },
      () => setError("Unable to load your training records."),
    );
    const unsubPayments = subscribeMyPayments(user.uid, setPayments, () => {});
    return () => {
      unsubEnrollments();
      unsubPayments();
    };
  }, [user?.uid]);

  if (loading) {
    return <p className="py-10 text-center text-sm text-muted">Loading your training and payment records...</p>;
  }
  if (error) {
    return <p className="rounded-xl bg-active p-4 text-sm text-primary">{error}</p>;
  }
  if (!enrollments.length) {
    return (
      <div className="rounded-3xl border border-dashed border-border-subtle bg-white p-8 text-center text-sm text-muted">
        You are not enrolled in any offline training yet.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {enrollments.map((enrollment) => {
        const trainingFee = Number(enrollment.trainingFee) || 0;
        const discount = Number(enrollment.discount) || 0;
        const finalFee = Number(enrollment.finalFee) || 0;
        const totalPaid = Number(enrollment.totalPaid) || 0;
        const dueAmount = Number.isFinite(enrollment.dueAmount) ? enrollment.dueAmount : Math.max(0, finalFee - totalPaid);
        const paymentStatus = enrollment.paymentStatus || "Unpaid";
        const expanded = expandedId === enrollment.id;
        const myPaymentsForThis = payments.filter((item) => item.enrollmentId === enrollment.id);

        return (
          <section key={enrollment.id} className="rounded-3xl border border-border-subtle bg-white p-5 shadow-sm md:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold text-ink">{enrollment.courseTitle}</h3>
                <p className="text-xs text-muted">Offline Training · {enrollment.courseCode}</p>
              </div>
              <PaymentStatusBadge value={paymentStatus} />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 rounded-2xl bg-page p-4 text-center sm:grid-cols-3 lg:grid-cols-6">
              <div><p className="text-[10px] font-bold uppercase text-subtle">Training Fee</p><p className="mt-1 text-sm font-bold text-ink">{formatMoney(trainingFee)}</p></div>
              <div><p className="text-[10px] font-bold uppercase text-subtle">Discount</p><p className="mt-1 text-sm font-bold text-ink">{formatMoney(discount)}</p></div>
              <div><p className="text-[10px] font-bold uppercase text-subtle">Final Fee</p><p className="mt-1 text-sm font-bold text-ink">{formatMoney(finalFee)}</p></div>
              <div><p className="text-[10px] font-bold uppercase text-subtle">Paid</p><p className="mt-1 text-sm font-bold text-success">{formatMoney(totalPaid)}</p></div>
              <div><p className="text-[10px] font-bold uppercase text-subtle">Due</p><p className="mt-1 text-sm font-bold text-primary">{formatMoney(dueAmount)}</p></div>
              <div><p className="text-[10px] font-bold uppercase text-subtle">Status</p><p className="mt-1"><PaymentStatusBadge value={paymentStatus} /></p></div>
            </div>
            <button
              type="button"
              onClick={() => setExpandedId(expanded ? null : enrollment.id)}
              className="mt-4 rounded-xl border border-border-subtle px-4 py-2 text-xs font-bold text-ink hover:bg-active hover:text-primary"
            >
              {expanded ? "Hide Payment History" : "Payment History"}
            </button>
            {expanded && (
              <div className="mt-4">
                <PaymentHistoryTable
                  payments={myPaymentsForThis}
                  studentName={user?.displayName || user?.email}
                  courseTitle={enrollment.courseTitle}
                  courseCode={enrollment.courseCode}
                  finalFee={finalFee}
                />
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
