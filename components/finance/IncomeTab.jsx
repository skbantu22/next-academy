"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { PaymentStatusBadge, Receipt, formatDate, formatMoney } from "../training/PaymentHistoryTable";

const methods = ["All", "Cash", "Bank Transfer", "Card", "Other"];

export default function IncomeTab({ payments, loading }) {
  const [studentSearch, setStudentSearch] = useState("");
  const [trainingSearch, setTrainingSearch] = useState("");
  const [methodFilter, setMethodFilter] = useState("All");
  const [dateFilter, setDateFilter] = useState("");
  const [receiptFor, setReceiptFor] = useState(null);

  const filtered = useMemo(
    () =>
      payments.filter(
        (item) =>
          (methodFilter === "All" || item.paymentMethod === methodFilter) &&
          (!dateFilter || item.paymentDate === dateFilter) &&
          `${item.studentName} ${item.userId}`.toLowerCase().includes(studentSearch.trim().toLowerCase()) &&
          `${item.courseTitle} ${item.courseCode}`.toLowerCase().includes(trainingSearch.trim().toLowerCase()),
      ),
    [payments, methodFilter, dateFilter, studentSearch, trainingSearch],
  );

  return (
    <section className="rounded-3xl border border-border-subtle bg-white p-5 shadow-sm md:p-6">
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <label className="relative min-w-48 flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-subtle" />
          <input value={studentSearch} onChange={(event) => setStudentSearch(event.target.value)} placeholder="Search student" className="w-full rounded-xl border border-border-subtle bg-page py-2 pl-9 pr-3 text-sm" />
        </label>
        <label className="relative min-w-48 flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-subtle" />
          <input value={trainingSearch} onChange={(event) => setTrainingSearch(event.target.value)} placeholder="Search training" className="w-full rounded-xl border border-border-subtle bg-page py-2 pl-9 pr-3 text-sm" />
        </label>
        <select value={methodFilter} onChange={(event) => setMethodFilter(event.target.value)} className="rounded-xl border border-border-subtle px-3 py-2 text-sm">
          {methods.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
        <input type="date" value={dateFilter} onChange={(event) => setDateFilter(event.target.value)} className="rounded-xl border border-border-subtle px-3 py-2 text-sm" />
      </div>

      {loading ? (
        <p className="py-10 text-center text-sm text-muted">Loading payments...</p>
      ) : filtered.length ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="border-b text-[10px] uppercase tracking-wider text-subtle">
              <tr>
                {["Payment ID", "Student", "Training", "Payment Date", "Amount", "Method", "Reference", "Recorded By", "Status", "Receipt"].map((label) => (
                  <th key={label} className="p-3">{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => (
                <tr key={item.id} className="border-b border-border-subtle">
                  <td className="max-w-32 truncate p-3 font-mono text-xs text-muted" title={item.id}>{item.id}</td>
                  <td className="p-3"><b className="block">{item.studentName}</b><span className="text-xs text-muted">{item.userId}</span></td>
                  <td className="p-3"><b className="block">{item.courseTitle}</b><span className="font-mono text-xs text-muted">{item.courseCode}</span></td>
                  <td className="p-3 text-xs">{formatDate(item.paymentDate)}</td>
                  <td className="p-3 text-xs font-bold text-success">{formatMoney(item.amount)}</td>
                  <td className="p-3 text-xs text-muted">{item.paymentMethod}</td>
                  <td className="p-3 text-xs text-muted">{item.reference || "—"}</td>
                  <td className="p-3 text-xs text-muted">{item.recordedByName}</td>
                  <td className="p-3"><PaymentStatusBadge value={item.status || "Paid"} /></td>
                  <td className="p-3 text-xs font-bold">
                    <button type="button" onClick={() => setReceiptFor(item)} className="text-primary">View</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="py-10 text-center text-sm text-muted">No payments match your filters.</p>
      )}

      {receiptFor && (
        <Receipt
          payment={{
            ...receiptFor,
            dueAfter: Math.max(0, (Number(receiptFor.finalFee) || 0) - ((Number(receiptFor.previousPaid) || 0) + Number(receiptFor.amount))),
          }}
          studentName={receiptFor.studentName}
          courseTitle={receiptFor.courseTitle}
          courseCode={receiptFor.courseCode}
          close={() => setReceiptFor(null)}
        />
      )}
    </section>
  );
}
