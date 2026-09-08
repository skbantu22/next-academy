"use client";

import { useMemo } from "react";
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { BookOpen, WalletCards } from "lucide-react";
import { ChartCard, EmptyChartState, ErrorChartState } from "./ChartCard";

const PAYMENT_COLORS = { Paid: "#22C55E", Partial: "#F59E0B", Unpaid: "#FF2D2D" };

// The real, confirmed set of course lifecycle statuses this schema uses —
// anything else (legacy/unset docs) is bucketed into "Other" rather than
// silently dropped or guessed at.
const TRAINING_STATUS_COLORS = {
  Draft: "#98A2B3",
  Upcoming: "#3B82F6",
  Active: "#22C55E",
  Completed: "#667085",
  Archived: "#A855F7",
  Other: "#E7E5E4",
};

export default function StatusCharts({ totals, courses, coursesLoading, coursesError, onRetryCourses, loading }) {
  const paymentStatus = useMemo(() => {
    if (!totals) return [];
    return [
      { name: "Paid", value: totals.paidCount || 0 },
      { name: "Partial", value: totals.partialCount || 0 },
      { name: "Unpaid", value: totals.unpaidCount || 0 },
    ].filter((row) => row.value > 0);
  }, [totals]);

  const trainingStatus = useMemo(() => {
    if (!courses) return [];
    const counts = new Map();
    courses.forEach((course) => {
      const status = TRAINING_STATUS_COLORS[course.status] ? course.status : "Other";
      counts.set(status, (counts.get(status) || 0) + 1);
    });
    return [...counts.entries()].map(([name, count]) => ({ name, count }));
  }, [courses]);

  const maxTrainingCount = Math.max(1, ...trainingStatus.map((row) => row.count));

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <ChartCard title="Payment Status" subtitle="Real financial status across all admissions" icon={WalletCards}>
        {loading ? (
          <EmptyChartState message="Loading payment status..." />
        ) : paymentStatus.length ? (
          <div className="h-70 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={paymentStatus} dataKey="value" nameKey="name" innerRadius="55%" outerRadius="80%" paddingAngle={2}>
                  {paymentStatus.map((entry) => (
                    <Cell key={entry.name} fill={PAYMENT_COLORS[entry.name]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value, name) => {
                    const total = paymentStatus.reduce((sum, row) => sum + row.value, 0);
                    const percent = total ? ((value / total) * 100).toFixed(1) : "0";
                    return [`${value} (${percent}%)`, name];
                  }}
                  contentStyle={{ borderRadius: 12, border: "1px solid #e7e5e4", fontSize: 12 }}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} verticalAlign="bottom" height={36} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <EmptyChartState message="No payment records yet" />
        )}
      </ChartCard>

      <ChartCard title="Training Status" subtitle="Lifecycle stage across all trainings" icon={BookOpen}>
        {coursesLoading ? (
          <EmptyChartState message="Loading training status..." />
        ) : coursesError ? (
          <ErrorChartState message="Unable to load training status" onRetry={onRetryCourses} />
        ) : trainingStatus.length ? (
          <div className="space-y-3 py-2">
            {trainingStatus.map((row) => (
              <div key={row.name} className="grid grid-cols-[90px_1fr_32px] items-center gap-3 text-xs">
                <span className="font-semibold text-ink">{row.name}</span>
                <span className="h-2.5 overflow-hidden rounded-full bg-page">
                  <span
                    className="block h-full rounded-full"
                    style={{ width: `${(row.count / maxTrainingCount) * 100}%`, backgroundColor: TRAINING_STATUS_COLORS[row.name] }}
                  />
                </span>
                <span className="text-right font-bold text-ink">{row.count}</span>
              </div>
            ))}
          </div>
        ) : (
          <EmptyChartState message="No training data yet" />
        )}
      </ChartCard>
    </div>
  );
}
