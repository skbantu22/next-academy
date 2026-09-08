import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminAuth, getAdminDb } from "../../../../../lib/firebase-admin";
import { verifyQrToken, QrTokenError } from "../../../../../lib/qr-token";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function access(request) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token)
    return { denied: NextResponse.json({ code: "unauthorized", message: "Sign in as a teacher to continue." }, { status: 401 }) };
  const db = getAdminDb();
  const decoded = await getAdminAuth().verifyIdToken(token);
  const profile = await db.collection("users").doc(decoded.uid).get();
  const data = profile.data() || {};
  if (!profile.exists || data.active === false || data.role !== "Teacher")
    return { denied: NextResponse.json({ code: "unauthorized", message: "Teacher access is required." }, { status: 403 }) };
  return { db, uid: decoded.uid };
}

function fail(code, message, status) {
  return NextResponse.json({ code, message }, { status });
}

export async function POST(request) {
  let a;
  try {
    a = await access(request);
  } catch {
    return fail("unauthorized", "Sign in as a teacher to continue.", 401);
  }
  if (a.denied) return a.denied;
  const { db, uid: teacherId } = a;

  const body = await request.json().catch(() => ({}));
  const classId = typeof body.classId === "string" ? body.classId : "";
  const rawToken = typeof body.token === "string" ? body.token : "";
  if (!classId) return fail("invalid_request", "Select a class before scanning.", 400);
  if (!rawToken) return fail("invalid_request", "No QR code data received.", 400);

  let payload;
  try {
    payload = verifyQrToken(rawToken);
  } catch (error) {
    if (error instanceof QrTokenError) {
      return fail(error.code, error.message, 400);
    }
    return fail("invalid", "Invalid QR code.", 400);
  }

  if (payload.kind !== "student") {
    return fail("invalid", "This QR code does not belong to a student.", 400);
  }

  const classSnapshot = await db.collection("classes").doc(classId).get();
  if (!classSnapshot.exists || !(classSnapshot.data().teacherIds || []).includes(teacherId)) {
    return fail("unauthorized", "You do not have access to this class.", 403);
  }

  const studentId = payload.sub;
  const studentSnapshot = await db.collection("users").doc(studentId).get();
  if (!studentSnapshot.exists || studentSnapshot.data().role !== "Student") {
    return fail("not_found", "Student not found.", 404);
  }
  const student = studentSnapshot.data();
  if (!(student.teacherIds || []).includes(teacherId)) {
    return fail("unauthorized", "This student is not assigned to you.", 403);
  }
  if ((student.qrVersion || 0) !== payload.v) {
    return fail("expired", "This QR code has been replaced. Ask for a reissued ID card.", 400);
  }

  const date = new Date().toISOString().slice(0, 10);
  const attendanceId = `${classId}_${studentId}_${date}`;
  const attendanceRef = db.collection("attendance").doc(attendanceId);
  const existing = await attendanceRef.get();

  const studentSummary = {
    id: studentId,
    displayName: student.displayName || "",
    email: student.email || "",
  };

  if (existing.exists) {
    return NextResponse.json({
      code: "already_marked",
      message: "Attendance was already recorded for this student today.",
      student: studentSummary,
      attendance: { id: attendanceId, ...existing.data(), markedAt: undefined },
    });
  }

  const courseId = classSnapshot.data().courseId || "";
  await attendanceRef.set({
    classId,
    courseId,
    teacherId,
    studentId,
    date,
    status: "present",
    markedBy: teacherId,
    markedAt: FieldValue.serverTimestamp(),
  });
  await db.collection("activities").add({
    actorId: teacherId,
    teacherId,
    type: "attendance.scanned",
    title: "Attendance marked via QR scan",
    description: studentSummary.displayName || studentSummary.email || studentId,
    entityId: attendanceId,
    createdAt: FieldValue.serverTimestamp(),
  });
  await db.collection("notifications").add({
    userId: studentId,
    type: "attendance",
    title: "Attendance marked",
    body: `You were marked present in ${classSnapshot.data().name || "class"} today.`,
    entityId: attendanceId,
    actionUrl: null,
    readAt: null,
    createdAt: FieldValue.serverTimestamp(),
  });

  return NextResponse.json({
    code: "success",
    message: "Attendance marked.",
    student: studentSummary,
    class: { id: classId, name: classSnapshot.data().name || "" },
  });
}
