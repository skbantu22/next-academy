import { FieldValue } from "firebase-admin/firestore";
import { checkAndIssueCertificate } from "./certificate-core";

// The ONE place that actually writes a QR-driven attendance record — used
// by both the existing teacher/admin-scans-student flow
// (app/api/teacher/attendance/scan) and the student-scans-session
// self-check-in flow (app/api/attendance/session-checkin). Two different
// entry points (different actor, different QR direction), one shared
// implementation, so there is exactly one attendance-writing code path —
// never a second attendance system.
//
// Same doc id convention as every other attendance record in this app
// (`${classId}_${studentId}_${date}`), same two-scans-per-day check-in/
// check-out convention, same `status: "present"` throughout so every
// existing consumer (lib/attendance.js's attendancePercent, reports, the
// Student Attendance page, etc.) keeps working unchanged. Wrapped in a
// transaction — the existing teacher-scan route previously did a plain
// get-then-set with no transaction; extracting it here also closes that
// real (if low-risk) race window, without changing its behavior at all.
export async function recordAttendanceScan(db, { classId, courseId, studentId, teacherId, markedBy, sessionId, location, className }) {
  const date = new Date().toISOString().slice(0, 10);
  const attendanceId = `${classId}_${studentId}_${date}`;
  const attendanceRef = db.collection("attendance").doc(attendanceId);

  const result = await db.runTransaction(async (transaction) => {
    const existing = await transaction.get(attendanceRef);
    const now = FieldValue.serverTimestamp();

    if (!existing.exists) {
      transaction.set(attendanceRef, {
        classId,
        courseId,
        teacherId,
        studentId,
        date,
        status: "present",
        markedBy,
        checkInAt: now,
        checkOutAt: null,
        durationMinutes: null,
        markedAt: now,
        ...(sessionId ? { sessionId, location: location || "" } : {}),
      });
      transaction.set(db.collection("activities").doc(), {
        actorId: markedBy,
        teacherId,
        type: "attendance.scanned",
        title: "Checked in via QR scan",
        description: studentId,
        entityId: attendanceId,
        createdAt: now,
      });
      transaction.set(db.collection("notifications").doc(), {
        userId: studentId,
        type: "attendance",
        title: "Checked in",
        body: `You were checked in to ${className || "class"} today.`,
        entityId: attendanceId,
        actionUrl: null,
        readAt: null,
        createdAt: now,
      });
      return { code: "checked_in", message: "Checked in.", attendanceId };
    }

    const record = existing.data();
    if (record.checkOutAt) {
      return { code: "already_checked_out", message: "Already checked in and out today.", attendanceId, record };
    }

    const checkInDate = record.checkInAt?.toDate?.() || null;
    const durationMinutes = checkInDate ? Math.max(0, Math.round((Date.now() - checkInDate.getTime()) / 60000)) : null;
    transaction.update(attendanceRef, { checkOutAt: now, durationMinutes });
    transaction.set(db.collection("activities").doc(), {
      actorId: markedBy,
      teacherId,
      type: "attendance.scanned",
      title: "Checked out via QR scan",
      description: studentId,
      entityId: attendanceId,
      createdAt: now,
    });
    transaction.set(db.collection("notifications").doc(), {
      userId: studentId,
      type: "attendance",
      title: "Checked out",
      body: `You were checked out of ${className || "class"}${durationMinutes != null ? ` after ${durationMinutes} minute${durationMinutes === 1 ? "" : "s"}` : ""}.`,
      entityId: attendanceId,
      actionUrl: null,
      readAt: null,
      createdAt: now,
    });
    return { code: "checked_out", message: "Checked out.", attendanceId, durationMinutes };
  });

  // Checking out can be the exact moment attendance crosses the course's
  // certificateMinAttendance threshold — re-derive eligibility from real
  // data right here (never a manual student request), exactly as before
  // this extraction. A failure here must never break the check-out
  // response the caller is waiting on.
  if (result.code === "checked_out" && courseId) {
    try {
      await checkAndIssueCertificate(db, { studentId, courseId });
    } catch (error) {
      console.error("[attendance-core] certificate check failed", { code: error?.code || "unknown", message: error?.message });
    }
  }

  return result;
}
