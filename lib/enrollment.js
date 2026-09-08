// Shared enrollment-capacity math — used server-side (API enforcement) and
// client-side (display), so the numbers a user sees always match what the
// backend actually enforces. "Maximum Students" and "Seat Capacity" are both
// respected: whichever is set and smaller wins.
export function effectiveCapacity(maxStudents, seatCapacity) {
  const values = [maxStudents, seatCapacity].filter(
    (value) => typeof value === "number" && Number.isFinite(value) && value > 0,
  );
  return values.length ? Math.min(...values) : null;
}

export function capacityLabel(enrolledCount, capacity) {
  return capacity == null ? `${enrolledCount} Students` : `${enrolledCount} / ${capacity} Students`;
}

export function capacityRemainingLabel(enrolledCount, capacity) {
  if (capacity == null) return "";
  const remaining = capacity - enrolledCount;
  if (remaining <= 0) return "Class Full";
  return `${remaining} seat${remaining === 1 ? "" : "s"} remaining`;
}

export function isFull(enrolledCount, capacity) {
  return capacity != null && enrolledCount >= capacity;
}
