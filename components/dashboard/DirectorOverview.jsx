"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { BookOpen, GraduationCap, Layers, Presentation, RefreshCw, UserCheck, Wallet } from "lucide-react";
import { studentApi } from "../../lib/services/student-service";
import { loadTeacherAssignmentData } from "../../lib/services/teacher-assignment-service";
import { loadFinanceOverview } from "../../lib/services/finance-service";
import { formatMoney } from "../training/PaymentHistoryTable";
import StatCard from "../finance/StatCard";

// Same red/white accent used everywhere else in the app (--dash-primary and
// friends from app/globals.css) — chart series reuse those exact tokens
// instead of inventing a new palette.
const CHART_COLORS = ["#FF2D2D", "#F59E0B", "#22C55E", "#3B82F6", "#A855F7", "#14B8A6", "#EC4899"];
const MAX_CHART_SLICES = 6;

function monthLabel(monthKey) {
  const [year, month] = monthKey.split("-").map(Number);
  return new Date(year, month - 1, 1).toLocaleString("en-US", { month: "short", year: "numeric" });
}

// Groups a long tail of trainings into "Other" so the bar/doughnut charts
// stay readable instead of rendering dozens of slivers.
function topSlices(rows) {
  if (rows.length <= MAX_CHART_SLICES) return rows;
  const sorted = [...rows].sort((a, b) => b.count - a.count);
  const top = sorted.slice(0, MAX_CHART_SLICES - 1);
  const otherCount = sorted.slice(MAX_CHART_SLICES - 1).reduce((sum, item) => sum + item.count, 0);
  return [...top, { name: "Other", count: otherCount }];
}

async function fetchOverviewData() {
  const [studentsRes, teacherRes, financeRes] = await Promise.all([
    studentApi(),
    loadTeacherAssignmentData(),
    loadFinanceOverview(),
  ]);
  return {
    students: studentsRes.students || [],
    teachers: teacherRes.teachers || [],
    courses: teacherRes.courses || [],
    classes: teacherRes.classes || [],
    admissions: financeRes.admissions || [],
    payments: financeRes.payments || [],
    totalIncome: financeRes.totals?.income || 0,
  };
}

function ChartCard({ title, subtitle, icon: Icon, children }) {
  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-border-subtle bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold text-ink">{title}</h3>
          <p className="text-xs text-muted">{subtitle}</p>
        </div>
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-active text-primary">
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
      </div>
      {children}
    </div>
  );
}

function EmptyChartState({ message }) {
  return <p className="grid h-70 place-items-center text-center text-sm text-muted">{message}</p>;
}

export default function DirectorOverview() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(() => fetchOverviewData(), []);

  useEffect(() => {
    let cancelled = false;
    load()
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || "Unable to load dashboard analytics.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [load]);

  function handleRefresh() {
    setRefreshing(true);
    setError("");
    load()
      .then(setData)
      .catch((err) => setError(err.message || "Unable to refresh dashboard analytics."))
      .finally(() => setRefreshing(false));
  }

  const stats = useMemo(() => {
    if (!data) return null;
    return {
      students: data.students.length,
      teachers: data.teachers.length,
      trainings: data.courses.length,
      batches: data.classes.length,
      enrollments: data.admissions.length,
      revenue: data.totalIncome,
    };
  }, [data]);

  const enrollmentByTraining = useMemo(() => {
    if (!data) return [];
    const counts = new Map();
    data.admissions.forEach((item) => {
      const name = item.courseTitle || "Untitled training";
      counts.set(name, (counts.get(name) || 0) + 1);
    });
    return topSlices([...counts.entries()].map(([name, count]) => ({ name, count })));
  }, [data]);

  const monthlyRevenue = useMemo(() => {
    if (!data) return [];
    const totals = new Map();
    data.payments.forEach((payment) => {
      const key = (payment.paymentDate || "").slice(0, 7);
      if (!key) return;
      totals.set(key, (totals.get(key) || 0) + (Number(payment.amount) || 0));
    });
    return [...totals.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, amount]) => ({ month: monthLabel(key), amount }));
  }, [data]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-ink">Overview &amp; Analytics</h2>
          <p className="mt-1 text-sm text-muted">Monitor your LMS performance and business growth</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center rounded-full border border-red-line bg-active px-3 py-1 text-xs font-semibold text-primary">
            <span className="mr-1.5 h-2 w-2 rounded-full bg-primary animate-pulse" aria-hidden="true" />
            Live data
          </span>
          <button
            type="button"
            onClick={handleRefresh}
            disabled={loading || refreshing}
            className="inline-flex items-center gap-2 rounded-xl border border-border-subtle bg-white px-4 py-2 text-xs font-bold text-ink shadow-sm transition hover:bg-active disabled:opacity-60"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} aria-hidden="true" />
            Refresh Stats
          </button>
        </div>
      </div>

      {error && <p className="rounded-xl bg-active p-3 text-xs font-semibold text-primary">{error}</p>}

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard label="Total Students" value={stats?.students} loading={loading} icon={GraduationCap} iconBg="bg-active" iconColor="text-primary" />
        <StatCard label="Total Teachers" value={stats?.teachers} loading={loading} icon={Presentation} iconBg="bg-active" iconColor="text-primary" />
        <StatCard label="Total Trainings" value={stats?.trainings} loading={loading} icon={BookOpen} iconBg="bg-active" iconColor="text-primary" />
        <StatCard label="Total Batches" value={stats?.batches} loading={loading} icon={Layers} iconBg="bg-active" iconColor="text-primary" />
        <StatCard label="Total Enrollments" value={stats?.enrollments} loading={loading} icon={UserCheck} iconBg="bg-active" iconColor="text-primary" />
        <StatCard label="Total Revenue" value={stats?.revenue} format={formatMoney} loading={loading} icon={Wallet} iconBg="bg-active" iconColor="text-primary" />
      </section>

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ChartCard title="Training-wise Enrollment" subtitle="Number of students enrolled per training program" icon={BookOpen}>
          {loading ? (
            <EmptyChartState message="Loading enrollment data..." />
          ) : enrollmentByTraining.length ? (
            <div className="h-70 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={enrollmentByTraining} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 11, fill: "#667085" }}
                    interval={0}
                    angle={enrollmentByTraining.length > 4 ? -20 : 0}
                    textAnchor={enrollmentByTraining.length > 4 ? "end" : "middle"}
                    height={enrollmentByTraining.length > 4 ? 50 : 30}
                  />
                  <YAxis allowDecimals={false} domain={[0, "dataMax"]} tick={{ fontSize: 11, fill: "#667085" }} />
                  <Tooltip
                    cursor={{ fill: "#fff1f1" }}
                    formatter={(value) => [`${value} students`, "Enrolled"]}
                    contentStyle={{ borderRadius: 12, border: "1px solid #e7e5e4", fontSize: 12 }}
                  />
                  <Bar dataKey="count" name="Enrolled Students" radius={[6, 6, 0, 0]} maxBarSize={40}>
                    {enrollmentByTraining.map((entry, index) => (
                      <Cell key={entry.name} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyChartState message="No enrollments recorded yet." />
          )}
        </ChartCard>

        <ChartCard title="Enrollment Distribution" subtitle="Proportional share across training programs" icon={UserCheck}>
          {loading ? (
            <EmptyChartState message="Loading enrollment data..." />
          ) : enrollmentByTraining.length ? (
            <div className="h-70 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={enrollmentByTraining}
                    dataKey="count"
                    nameKey="name"
                    innerRadius="55%"
                    outerRadius="80%"
                    paddingAngle={2}
                  >
                    {enrollmentByTraining.map((entry, index) => (
                      <Cell key={entry.name} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value, name, item) => {
                      const total = enrollmentByTraining.reduce((sum, row) => sum + row.count, 0);
                      const percent = total ? ((item.value / total) * 100).toFixed(1) : "0";
                      return [`${value} (${percent}%)`, name];
                    }}
                    contentStyle={{ borderRadius: 12, border: "1px solid #e7e5e4", fontSize: 12 }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} verticalAlign="bottom" height={36} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyChartState message="No enrollments recorded yet." />
          )}
        </ChartCard>
      </section>

      <ChartCard title="Monthly Revenue Analytics" subtitle="Track successful payments and installments month over month" icon={Wallet}>
        {loading ? (
          <EmptyChartState message="Loading revenue data..." />
        ) : monthlyRevenue.length ? (
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthlyRevenue} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="directorRevenueFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#FF2D2D" stopOpacity={0.16} />
                    <stop offset="100%" stopColor="#FF2D2D" stopOpacity={0.02} />
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
                  stroke="#FF2D2D"
                  strokeWidth={3}
                  fill="url(#directorRevenueFill)"
                  dot={{ r: 4, fill: "#FF2D2D", strokeWidth: 2, stroke: "#ffffff" }}
                  activeDot={{ r: 6 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <EmptyChartState message="No successful payments recorded yet." />
        )}
      </ChartCard>
    </div>
  );
}
