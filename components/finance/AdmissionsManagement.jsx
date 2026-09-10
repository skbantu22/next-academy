"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BadgeCheck, CircleAlert, CircleDollarSign, Receipt, Search, Users, Wallet } from "lucide-react";
import { loadAdmissions } from "../../lib/services/payment-service";
import { PaymentStatusBadge, formatDate, formatMoney } from "../training/PaymentHistoryTable";
import StatCard from "./StatCard";

const filters = ["All", "Paid", "Partial", "Unpaid"];

// Cross-training admissions/finance view for Director/Admin. Read-only here
// by design — "View"/"Collect Payment" deep-link into the training's own
// Students tab (components/training/EnrollmentManager.jsx), which already
// has the real payment-collection UI. Keeping the actual money-moving
// action in one place avoids a second, divergent payment flow.
export default function AdmissionsManagement() {
  const [admissions, setAdmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [studentSearch, setStudentSearch] = useState("");
  const [trainingSearch, setTrainingSearch] = useState("");

  useEffect(() => {
    let cancelled = false;
    loadAdmissions()
      .then((result) => {
        if (!cancelled) setAdmissions(result.admissions);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || "Unable to load admissions.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(
    () =>
      admissions.filter(
        (item) =>
          (statusFilter === "All" || item.paymentStatus === statusFilter) &&
          `${item.studentName} ${item.userId}`.toLowerCase().includes(studentSearch.trim().toLowerCase()) &&
          `${item.courseTitle} ${item.courseCode}`.toLowerCase().includes(trainingSearch.trim().toLowerCase()),
      ),
    [admissions, statusFilter, studentSearch, trainingSearch],
  );

  const summary = useMemo(
    () => ({
      total: admissions.length,
      collected: admissions.reduce((sum, item) => sum + (Number(item.totalPaid) || 0), 0),
      due: admissions.reduce((sum, item) => sum + (Number(item.dueAmount) || 0), 0),
      paid: admissions.filter((item) => item.paymentStatus === "Paid").length,
      partial: admissions.filter((item) => item.paymentStatus === "Partial").length,
      unpaid: admissions.filter((item) => item.paymentStatus === "Unpaid").length,
    }),
    [admissions],
  );

  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-[#f3aaaa] bg-[linear-gradient(120deg,#fff0f0_0%,#fff7f7_45%,#ffffff_100%)] p-6 text-ink shadow-xl">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-primary">Finance</p>
          <h2 className="mt-2 text-3xl font-black">Admissions</h2>
          <p className="mt-2 text-sm text-muted">Track admission fees, payments collected, and outstanding dues across every training.</p>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard label="Total Admissions" value={summary.total} loading={loading} icon={Users} iconBg="bg-info-soft" iconColor="text-info" />
        <StatCard label="Collected" value={summary.collected} format={formatMoney} loading={loading} icon={Wallet} iconBg="bg-success-soft" iconColor="text-success" valueColor="text-success" />
        <StatCard label="Outstanding Due" value={summary.due} format={formatMoney} loading={loading} icon={Receipt} iconBg="bg-warning-soft" iconColor="text-warning" valueColor="text-warning" />
        <StatCard label="Paid Admissions" value={summary.paid} loading={loading} icon={BadgeCheck} iconBg="bg-success-soft" iconColor="text-success" valueColor="text-success" />
        <StatCard label="Partial Admissions" value={summary.partial} loading={loading} icon={CircleDollarSign} iconBg="bg-purple-soft" iconColor="text-purple" />
        <StatCard label="Unpaid Admissions" value={summary.unpaid} loading={loading} icon={CircleAlert} iconBg="bg-active" iconColor="text-primary" valueColor="text-primary" />
      </section>

      <section className="rounded-3xl border border-border-subtle bg-white p-5 shadow-sm md:p-6">
        <div className="mb-5 flex flex-wrap items-center gap-3">
          <div className="flex flex-wrap gap-2">
            {filters.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setStatusFilter(item)}
                className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${statusFilter === item ? "bg-primary text-white" : "bg-page text-muted hover:bg-active hover:text-primary"}`}
              >
                {item}
              </button>
            ))}
          </div>
          <label className="relative min-w-48 flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-subtle" />
            <input
              value={studentSearch}
              onChange={(event) => setStudentSearch(event.target.value)}
              placeholder="Search student"
              className="w-full rounded-xl border border-border-subtle bg-page py-2 pl-9 pr-3 text-sm"
            />
          </label>
          <label className="relative min-w-48 flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-subtle" />
            <input
              value={trainingSearch}
              onChange={(event) => setTrainingSearch(event.target.value)}
              placeholder="Search training"
              className="w-full rounded-xl border border-border-subtle bg-page py-2 pl-9 pr-3 text-sm"
            />
          </label>
        </div>

        {error && <p className="mb-3 rounded-xl bg-active p-3 text-xs text-primary">{error}</p>}

        {loading ? (
          <p className="py-10 text-center text-sm text-muted">Loading admissions...</p>
        ) : filtered.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="border-b text-[10px] uppercase tracking-wider text-subtle">
                <tr>
                  {["Student", "Training", "Total Fee", "Discount", "Final Fee", "Total Paid", "Outstanding Due", "Payment Status", "Admission Date", "Actions"].map((label) => (
                    <th key={label} className="p-3">{label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((item) => (
                  <tr key={item.enrollmentId} className="border-b border-border-subtle">
                    <td className="p-3">
                      <b className="block">{item.studentName}</b>
                      <span className="text-xs text-muted">{item.userId}</span>
                    </td>
                    <td className="p-3">
                      <b className="block">{item.courseTitle}</b>
                      <span className="font-mono text-xs text-muted">{item.courseCode}</span>
                    </td>
                    <td className="p-3 text-xs text-muted">{formatMoney(item.trainingFee)}</td>
                    <td className="p-3 text-xs text-muted">{formatMoney(item.discount)}</td>
                    <td className="p-3 text-xs font-bold text-ink">{formatMoney(item.finalFee)}</td>
                    <td className="p-3 text-xs font-bold text-success">{formatMoney(item.totalPaid)}</td>
                    <td className="p-3 text-xs font-bold text-primary">{formatMoney(item.dueAmount)}</td>
                    <td className="p-3"><PaymentStatusBadge value={item.paymentStatus} /></td>
                    <td className="p-3 text-xs text-muted">{formatDate(item.admissionDate)}</td>
                    <td className="p-3 text-xs font-bold">
                      <Link href={`/dashboard/training/${item.courseId}`} className="text-primary">
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="py-10 text-center text-sm text-muted">
            {statusFilter !== "All" || studentSearch || trainingSearch ? "No admissions match your filters." : "No admissions recorded yet."}
          </p>
        )}
      </section>
    </div>
  );
}
