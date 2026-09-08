// Single source of truth for attendance-percentage math, shared by both the
// server-side students API and every client attendance view. "excused"
// records are excluded from both the numerator and the denominator — they
// neither help nor hurt the rate. Percentage is computed against records
// actually taken, not the training's total scheduled class count.
export function attendancePercent(records) {
  const counted = (records || []).filter((item) => item.status !== "excused");
  if (!counted.length) return null;
  const attended = counted.filter((item) => ["present", "late"].includes(item.status)).length;
  return Math.round((attended / counted.length) * 100);
}
