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

// One shared breakdown (percent + per-status counts) reused by the Student
// Dashboard's Attendance card and the full Attendance page, so the two
// numbers can never drift apart — both call this same function on the same
// records. `total` follows attendancePercent's own definition of "sessions
// actually taken" (excused records excluded), not a theoretical scheduled
// count this schema doesn't track.
export function attendanceSummary(records) {
  const all = records || [];
  const counted = all.filter((item) => item.status !== "excused");
  const present = counted.filter((item) => item.status === "present").length;
  const late = counted.filter((item) => item.status === "late").length;
  const absent = counted.filter((item) => item.status === "absent").length;
  const excused = all.filter((item) => item.status === "excused").length;
  return {
    percent: attendancePercent(all),
    present,
    late,
    absent,
    excused,
    total: counted.length,
  };
}
