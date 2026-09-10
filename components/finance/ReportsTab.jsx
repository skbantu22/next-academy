"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { loadFinanceOverview } from "../../lib/services/finance-service";
import { formatDate, formatMoney } from "../training/PaymentHistoryTable";

const reportTypes = [
  "Income Report",
  "Expense Report",
  "Outstanding Due Report",
  "Profit & Loss Report",
  "Student Payment Report",
  "Training Revenue Report",
  "Monthly Financial Report",
];

function groupSum(items, keyFn, amountFn) {
  const map = new Map();
  for (const item of items) {
    const key = keyFn(item);
    map.set(key, (map.get(key) || 0) + amountFn(item));
  }
  return map;
}

// No PDF/Excel export exists anywhere in the project — each report is a
// clean, self-contained table computed from the same overview payload the
// rest of Finance uses, so an export button can later be added per-report
// without touching this calculation logic.
export default function ReportsTab() {
  const [reportType, setReportType] = useState("Income Report");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    loadFinanceOverview({ from: from || undefined, to: to || undefined })
      .then((result) => {
        setOverview(result);
        setError("");
      })
      .catch((err) => setError(err.message || "Unable to load report data."))
      .finally(() => setLoading(false));
  }, [from, to]);

  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);

  const payments = useMemo(() => overview?.payments || [], [overview]);
  const expenses = useMemo(() => overview?.expenses || [], [overview]);
  const admissions = useMemo(() => overview?.admissions || [], [overview]);

  const studentSummary = useMemo(() => {
    const paidMap = groupSum(payments, (p) => p.studentId, (p) => p.amount);
    return [...paidMap.entries()]
      .map(([studentId, total]) => {
        const sample = payments.find((p) => p.studentId === studentId);
        return { studentId, studentName: sample?.studentName, userId: sample?.userId, total };
      })
      .sort((a, b) => b.total - a.total);
  }, [payments]);

  const trainingSummary = useMemo(() => {
    const revenueMap = groupSum(payments, (p) => p.courseId, (p) => p.amount);
    return [...revenueMap.entries()]
      .map(([courseId, total]) => {
        const sample = payments.find((p) => p.courseId === courseId);
        return { courseId, courseTitle: sample?.courseTitle, courseCode: sample?.courseCode, total };
      })
      .sort((a, b) => b.total - a.total);
  }, [payments]);

  const monthlySummary = useMemo(() => {
    const monthKey = (dateStr) => (dateStr || "").slice(0, 7) || "Unknown";
    const incomeMap = groupSum(payments, (p) => monthKey(p.paymentDate), (p) => p.amount);
    const expenseMap = groupSum(expenses, (e) => monthKey(e.expenseDate), (e) => e.amount);
    const months = [...new Set([...incomeMap.keys(), ...expenseMap.keys()])].sort().reverse();
    return months.map((month) => {
      const income = incomeMap.get(month) || 0;
      const expense = expenseMap.get(month) || 0;
      return { month, income, expense, net: income - expense };
    });
  }, [payments, expenses]);

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-border-subtle bg-white p-5 shadow-sm md:p-6">
        <div className="mb-5 flex flex-wrap items-center gap-3">
          <select value={reportType} onChange={(event) => setReportType(event.target.value)} className="rounded-xl border border-border-subtle px-3 py-2 text-sm font-bold">
            {reportTypes.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
          <input type="date" value={from} onChange={(event) => setFrom(event.target.value)} className="rounded-xl border border-border-subtle px-3 py-2 text-sm" />
          <span className="text-xs text-subtle">to</span>
          <input type="date" value={to} onChange={(event) => setTo(event.target.value)} className="rounded-xl border border-border-subtle px-3 py-2 text-sm" />
        </div>

        {error && <p className="mb-3 rounded-xl bg-active p-3 text-xs text-primary">{error}</p>}

        {loading ? (
          <p className="py-10 text-center text-sm text-muted">Loading report...</p>
        ) : (
          <div className="overflow-x-auto">
            {reportType === "Income Report" && (
              <table className="w-full min-w-[700px] text-left text-sm">
                <thead className="border-b text-[10px] uppercase tracking-wider text-subtle"><tr>{["Date", "Student", "Training", "Amount", "Method"].map((l) => <th key={l} className="p-3">{l}</th>)}</tr></thead>
                <tbody>
                  {payments.map((p) => (
                    <tr key={p.id} className="border-b border-border-subtle">
                      <td className="p-3 text-xs">{formatDate(p.paymentDate)}</td>
                      <td className="p-3 text-xs">{p.studentName}</td>
                      <td className="p-3 text-xs">{p.courseTitle}</td>
                      <td className="p-3 text-xs font-bold text-success">{formatMoney(p.amount)}</td>
                      <td className="p-3 text-xs text-muted">{p.paymentMethod}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot><tr><td colSpan={3} className="p-3 text-right text-xs font-bold">Total</td><td className="p-3 text-xs font-bold text-success">{formatMoney(payments.reduce((s, p) => s + p.amount, 0))}</td><td /></tr></tfoot>
              </table>
            )}

            {reportType === "Expense Report" && (
              <table className="w-full min-w-[700px] text-left text-sm">
                <thead className="border-b text-[10px] uppercase tracking-wider text-subtle"><tr>{["Date", "Category", "Amount", "Method", "Description"].map((l) => <th key={l} className="p-3">{l}</th>)}</tr></thead>
                <tbody>
                  {expenses.map((e) => (
                    <tr key={e.id} className="border-b border-border-subtle">
                      <td className="p-3 text-xs">{formatDate(e.expenseDate)}</td>
                      <td className="p-3 text-xs">{e.category}</td>
                      <td className="p-3 text-xs font-bold text-warning">{formatMoney(e.amount)}</td>
                      <td className="p-3 text-xs text-muted">{e.paymentMethod}</td>
                      <td className="p-3 text-xs text-muted">{e.description || "—"}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot><tr><td colSpan={2} className="p-3 text-right text-xs font-bold">Total</td><td className="p-3 text-xs font-bold text-warning">{formatMoney(expenses.reduce((s, e) => s + e.amount, 0))}</td><td colSpan={2} /></tr></tfoot>
              </table>
            )}

            {reportType === "Outstanding Due Report" && (
              <table className="w-full min-w-[700px] text-left text-sm">
                <thead className="border-b text-[10px] uppercase tracking-wider text-subtle"><tr>{["Student", "Training", "Final Fee", "Paid", "Due", "Status"].map((l) => <th key={l} className="p-3">{l}</th>)}</tr></thead>
                <tbody>
                  {admissions.filter((a) => a.dueAmount > 0).map((a) => (
                    <tr key={a.enrollmentId} className="border-b border-border-subtle">
                      <td className="p-3 text-xs">{a.studentName}</td>
                      <td className="p-3 text-xs">{a.courseTitle}</td>
                      <td className="p-3 text-xs">{formatMoney(a.finalFee)}</td>
                      <td className="p-3 text-xs text-success">{formatMoney(a.totalPaid)}</td>
                      <td className="p-3 text-xs font-bold text-primary">{formatMoney(a.dueAmount)}</td>
                      <td className="p-3 text-xs">{a.paymentStatus}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {reportType === "Profit & Loss Report" && (
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-2xl bg-page p-5 text-center"><p className="text-[10px] font-bold uppercase text-subtle">Income</p><p className="mt-2 text-xl font-extrabold text-success">{formatMoney(overview?.totals.income)}</p></div>
                <div className="rounded-2xl bg-page p-5 text-center"><p className="text-[10px] font-bold uppercase text-subtle">Expenses</p><p className="mt-2 text-xl font-extrabold text-warning">{formatMoney(overview?.totals.expenses)}</p></div>
                <div className="rounded-2xl bg-page p-5 text-center"><p className="text-[10px] font-bold uppercase text-subtle">Net Profit</p><p className="mt-2 text-xl font-extrabold text-ink">{formatMoney(overview?.totals.netProfit)}</p></div>
              </div>
            )}

            {reportType === "Student Payment Report" && (
              <table className="w-full min-w-[500px] text-left text-sm">
                <thead className="border-b text-[10px] uppercase tracking-wider text-subtle"><tr>{["Student", "User ID", "Total Paid"].map((l) => <th key={l} className="p-3">{l}</th>)}</tr></thead>
                <tbody>
                  {studentSummary.map((row) => (
                    <tr key={row.studentId} className="border-b border-border-subtle">
                      <td className="p-3 text-xs">{row.studentName}</td>
                      <td className="p-3 text-xs text-muted">{row.userId}</td>
                      <td className="p-3 text-xs font-bold text-success">{formatMoney(row.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {reportType === "Training Revenue Report" && (
              <table className="w-full min-w-[500px] text-left text-sm">
                <thead className="border-b text-[10px] uppercase tracking-wider text-subtle"><tr>{["Training", "Training ID", "Total Revenue"].map((l) => <th key={l} className="p-3">{l}</th>)}</tr></thead>
                <tbody>
                  {trainingSummary.map((row) => (
                    <tr key={row.courseId} className="border-b border-border-subtle">
                      <td className="p-3 text-xs">{row.courseTitle}</td>
                      <td className="p-3 font-mono text-xs text-muted">{row.courseCode}</td>
                      <td className="p-3 text-xs font-bold text-success">{formatMoney(row.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {reportType === "Monthly Financial Report" && (
              <table className="w-full min-w-[500px] text-left text-sm">
                <thead className="border-b text-[10px] uppercase tracking-wider text-subtle"><tr>{["Month", "Income", "Expense", "Net"].map((l) => <th key={l} className="p-3">{l}</th>)}</tr></thead>
                <tbody>
                  {monthlySummary.map((row) => (
                    <tr key={row.month} className="border-b border-border-subtle">
                      <td className="p-3 text-xs">{row.month}</td>
                      <td className="p-3 text-xs text-success">{formatMoney(row.income)}</td>
                      <td className="p-3 text-xs text-warning">{formatMoney(row.expense)}</td>
                      <td className={`p-3 text-xs font-bold ${row.net >= 0 ? "text-success" : "text-primary"}`}>{formatMoney(row.net)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
