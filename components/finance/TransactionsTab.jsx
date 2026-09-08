"use client";

import { useMemo, useState } from "react";
import { formatDate, formatMoney } from "../training/PaymentHistoryTable";

// A derived view over the two real collections (payments + expenses) —
// deliberately NOT a separate `transactions` collection, so there is never
// a second, possibly-divergent record of the same money movement. No
// refund type is shown because no refund mechanism exists anywhere in the
// app to generate one.
const typeFilters = ["All", "Income", "Expense"];

export default function TransactionsTab({ payments, expenses, loading }) {
  const [typeFilter, setTypeFilter] = useState("All");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [trainingSearch, setTrainingSearch] = useState("");
  const [categorySearch, setCategorySearch] = useState("");

  const rows = useMemo(() => {
    const income = payments.map((item) => ({
      id: item.id,
      date: item.paymentDate,
      type: "Income",
      description: item.studentName,
      training: item.courseTitle,
      category: "—",
      income: item.amount,
      expense: 0,
      paymentMethod: item.paymentMethod,
      reference: item.reference,
      recordedByName: item.recordedByName,
    }));
    const expenseRows = expenses.map((item) => ({
      id: item.id,
      date: item.expenseDate,
      type: "Expense",
      description: item.description || item.category,
      training: "—",
      category: item.category,
      income: 0,
      expense: item.amount,
      paymentMethod: item.paymentMethod,
      reference: item.reference,
      recordedByName: item.recordedByName,
    }));
    return [...income, ...expenseRows].sort((left, right) => (right.date || "").localeCompare(left.date || ""));
  }, [payments, expenses]);

  const filtered = rows.filter(
    (row) =>
      (typeFilter === "All" || row.type === typeFilter) &&
      (!from || (row.date || "") >= from) &&
      (!to || (row.date || "") <= to) &&
      row.training.toLowerCase().includes(trainingSearch.trim().toLowerCase()) &&
      row.category.toLowerCase().includes(categorySearch.trim().toLowerCase()),
  );

  return (
    <section className="rounded-3xl border border-border-subtle bg-white p-5 shadow-sm md:p-6">
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="flex gap-2">
          {typeFilters.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setTypeFilter(item)}
              className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${typeFilter === item ? "bg-primary text-white" : "bg-page text-muted hover:bg-active hover:text-primary"}`}
            >
              {item}
            </button>
          ))}
        </div>
        <input type="date" value={from} onChange={(event) => setFrom(event.target.value)} className="rounded-xl border border-border-subtle px-3 py-2 text-sm" />
        <span className="text-xs text-subtle">to</span>
        <input type="date" value={to} onChange={(event) => setTo(event.target.value)} className="rounded-xl border border-border-subtle px-3 py-2 text-sm" />
        <input value={trainingSearch} onChange={(event) => setTrainingSearch(event.target.value)} placeholder="Filter by training" className="min-w-40 flex-1 rounded-xl border border-border-subtle bg-page px-3 py-2 text-sm" />
        <input value={categorySearch} onChange={(event) => setCategorySearch(event.target.value)} placeholder="Filter by category" className="min-w-40 flex-1 rounded-xl border border-border-subtle bg-page px-3 py-2 text-sm" />
      </div>

      {loading ? (
        <p className="py-10 text-center text-sm text-muted">Loading transactions...</p>
      ) : filtered.length ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="border-b text-[10px] uppercase tracking-wider text-subtle">
              <tr>
                {["Transaction ID", "Date", "Type", "Student / Description", "Training", "Category", "Income", "Expense", "Method", "Reference", "Recorded By"].map((label) => (
                  <th key={label} className="p-3">{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr key={`${row.type}-${row.id}`} className="border-b border-border-subtle">
                  <td className="max-w-28 truncate p-3 font-mono text-xs text-muted" title={row.id}>{row.id}</td>
                  <td className="p-3 text-xs">{formatDate(row.date)}</td>
                  <td className="p-3">
                    <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${row.type === "Income" ? "bg-success-soft text-success" : "bg-warning-soft text-warning"}`}>
                      {row.type}
                    </span>
                  </td>
                  <td className="p-3 text-xs font-semibold text-ink">{row.description}</td>
                  <td className="p-3 text-xs text-muted">{row.training}</td>
                  <td className="p-3 text-xs text-muted">{row.category}</td>
                  <td className="p-3 text-xs font-bold text-success">{row.income ? formatMoney(row.income) : "—"}</td>
                  <td className="p-3 text-xs font-bold text-warning">{row.expense ? formatMoney(row.expense) : "—"}</td>
                  <td className="p-3 text-xs text-muted">{row.paymentMethod}</td>
                  <td className="p-3 text-xs text-muted">{row.reference || "—"}</td>
                  <td className="p-3 text-xs text-muted">{row.recordedByName}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="py-10 text-center text-sm text-muted">No transactions match your filters.</p>
      )}
    </section>
  );
}
