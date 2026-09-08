"use client";

import { useMemo, useState } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { TrendingUp, Wallet } from "lucide-react";
import { formatMoney } from "../../training/PaymentHistoryTable";
import { ChartCard, EmptyChartState } from "./ChartCard";

const PERIODS = [
  { key: "6m", label: "6 Months" },
  { key: "12m", label: "12 Months" },
  { key: "ytd", label: "This Year" },
];

function monthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(key) {
  const [year, month] = key.split("-").map(Number);
  return new Date(year, month - 1, 1).toLocaleString("en-US", { month: "short", year: "numeric" });
}

// A fixed, zero-filled trailing window (rather than only the months that
// happen to have data) so the Period filter has something real to control
// and a trend line can show genuine dips to zero.
function monthKeysForPeriod(period) {
  const now = new Date();
  if (period === "ytd") {
    const keys = [];
    const cursor = new Date(now.getFullYear(), 0, 1);
    while (cursor <= now) {
      keys.push(monthKey(cursor));
      cursor.setMonth(cursor.getMonth() + 1);
    }
    return keys;
  }
  const span = period === "12m" ? 12 : 6;
  return Array.from({ length: span }, (_, i) => monthKey(new Date(now.getFullYear(), now.getMonth() - (span - 1 - i), 1)));
}

function trendBadge(series, key) {
  if (series.length < 2) return null;
  const last = series[series.length - 1][key];
  const prev = series[series.length - 2][key];
  if (!prev) return null;
  const change = Math.round(((last - prev) / prev) * 100);
  return `${change >= 0 ? "+" : ""}${change}% vs previous period`;
}

export default function TrendCharts({ admissions, payments, loading }) {
  const [period, setPeriod] = useState("6m");
  const monthKeys = useMemo(() => monthKeysForPeriod(period), [period]);

  const enrollmentTrend = useMemo(() => {
    const counts = new Map();
    (admissions || []).forEach((item) => {
      const key = (item.admissionDate || "").slice(0, 7);
      if (key) counts.set(key, (counts.get(key) || 0) + 1);
    });
    return monthKeys.map((key) => ({ month: monthLabel(key), count: counts.get(key) || 0 }));
  }, [admissions, monthKeys]);

  const revenueTrend = useMemo(() => {
    const totals = new Map();
    (payments || []).forEach((payment) => {
      const key = (payment.paymentDate || "").slice(0, 7);
      if (key) totals.set(key, (totals.get(key) || 0) + (Number(payment.amount) || 0));
    });
    return monthKeys.map((key) => ({ month: monthLabel(key), amount: totals.get(key) || 0 }));
  }, [payments, monthKeys]);

  const hasEnrollmentData = enrollmentTrend.some((row) => row.count > 0);
  const hasRevenueData = revenueTrend.some((row) => row.amount > 0);
  const enrollmentBadge = hasEnrollmentData ? trendBadge(enrollmentTrend, "count") : null;

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[10px] font-bold uppercase tracking-wider text-subtle">Period</p>
        <div className="flex gap-2">
          {PERIODS.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setPeriod(item.key)}
              className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${period === item.key ? "bg-primary text-white" : "bg-page text-muted hover:bg-active hover:text-primary"}`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ChartCard
          title="Monthly Enrollment Trend"
          subtitle="How student enrollments changed over time"
          icon={TrendingUp}
          badge={enrollmentBadge}
        >
          {loading ? (
            <EmptyChartState message="Loading enrollment trend..." />
          ) : hasEnrollmentData ? (
            <div className="h-70 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={enrollmentTrend} margin={{ top: 8, right: 16, left: -16, bottom: 0 }}>
                  <defs>
                    <linearGradient id="enrollmentTrendFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#3B82F6" stopOpacity={0.18} />
                      <stop offset="100%" stopColor="#3B82F6" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#667085" }} />
                  <YAxis allowDecimals={false} domain={[0, "dataMax"]} tick={{ fontSize: 11, fill: "#667085" }} />
                  <Tooltip
                    formatter={(value) => [`${value} students`, "Enrolled"]}
                    contentStyle={{ borderRadius: 12, border: "1px solid #e7e5e4", fontSize: 12 }}
                  />
                  <Area
                    type="natural"
                    dataKey="count"
                    name="Enrolled"
                    stroke="#3B82F6"
                    strokeWidth={3}
                    fill="url(#enrollmentTrendFill)"
                    dot={{ r: 4, fill: "#3B82F6", strokeWidth: 2, stroke: "#ffffff" }}
                    activeDot={{ r: 6 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyChartState message="No enrollment data yet" />
          )}
        </ChartCard>

        <ChartCard title="Monthly Revenue" subtitle="Actual collected payments over time" icon={Wallet}>
          {loading ? (
            <EmptyChartState message="Loading revenue data..." />
          ) : hasRevenueData ? (
            <div className="h-70 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={revenueTrend} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="revenueTrendFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#22C55E" stopOpacity={0.18} />
                      <stop offset="100%" stopColor="#22C55E" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#667085" }} />
                  <YAxis domain={[0, "dataMax"]} tick={{ fontSize: 11, fill: "#667085" }} tickFormatter={(value) => formatMoney(value)} width={80} />
                  <Tooltip
                    formatter={(value) => [formatMoney(value), "Revenue"]}
                    contentStyle={{ borderRadius: 12, border: "1px solid #e7e5e4", fontSize: 12 }}
                  />
                  <Area
                    type="natural"
                    dataKey="amount"
                    name="Revenue"
                    stroke="#22C55E"
                    strokeWidth={3}
                    fill="url(#revenueTrendFill)"
                    dot={{ r: 4, fill: "#22C55E", strokeWidth: 2, stroke: "#ffffff" }}
                    activeDot={{ r: 6 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyChartState message="No revenue data yet" />
          )}
        </ChartCard>
      </div>
    </section>
  );
}
