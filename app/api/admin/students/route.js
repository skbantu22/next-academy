import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminAuth, getAdminDb } from "../../../../lib/firebase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const managers = new Set(["Admin", "Director"]);
const inactiveClasses = new Set(["archived", "cancelled"]);
const plain = (snapshot) => ({ id: snapshot.id, ...snapshot.data() });
const percent = (value, total) => (total ? Math.round((value / total) * 100) : null);

function failure(stage, error) {
  console.error("[students-api] request failed", { stage, code: error?.code || "unknown" });
  const credentials = error?.message?.includes("Firebase Admin credentials are not configured");
  return NextResponse.json({ message: credentials ? "Student API failed at Firebase Admin initialization. Configure the server Firebase Admin credentials." : `Student API failed at ${stage}. Check the server log for the safe error code.` }, { status: 500 });
}
async function requireManager(request) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return { denied: NextResponse.json({ message: "Administrator access is required." }, { status: 401 }) };
  const auth = getAdminAuth(); const db = getAdminDb();
  const decoded = await auth.verifyIdToken(token);
  const profile = await db.collection("users").doc(decoded.uid).get();
  if (!profile.exists || profile.data().active === false || !managers.has(profile.data().role)) return { denied: NextResponse.json({ message: "Administrator access is required." }, { status: 403 }) };
  return { auth, db };
}

export async function GET(request) {
  try {
    const access = await requireManager(request); if (access.denied) return access.denied;
    const { db } = access;
    if (new URL(request.url).searchParams.get("resource") === "courses") {
      const [courses, classes, teachers] = await Promise.all([db.collection("courses").get(), db.collection("classes").get(), db.collection("users").where("role", "==", "Teacher").get()]);
      const available = new Set(classes.docs.map(plain).filter((item) => !inactiveClasses.has(item.status)).map((item) => item.courseId));
      const byId = new Map(teachers.docs.map((item) => [item.id, plain(item)]));
      return NextResponse.json({ courses: courses.docs.map(plain).map((item) => ({ id: item.id, title: item.title || item.name || "Untitled course", enrollmentAvailable: available.has(item.id), teachers: (item.teacherIds || []).map((id) => byId.get(id)).filter(Boolean).map((teacher) => ({ id: teacher.id, name: teacher.displayName || teacher.email || "Teacher" })) })).sort((a, b) => a.title.localeCompare(b.title)) });
    }
    const [students, enrollmentDocs, courseDocs, assignments, submissions, attendance] = await Promise.all([db.collection("users").where("role", "==", "Student").get(), db.collection("enrollments").get(), db.collection("courses").get(), db.collection("assignments").get(), db.collection("submissions").get(), db.collection("attendance").get()]);
    const enrollments = enrollmentDocs.docs.map(plain), courseMap = new Map(courseDocs.docs.map((item) => [item.id, plain(item)])), assignmentRows = assignments.docs.map(plain), submissionRows = submissions.docs.map(plain), attendanceRows = attendance.docs.map(plain);
    const rows = students.docs.map(plain).map((student) => {
      const own = enrollments.filter((item) => item.studentId === student.id), courseIds = new Set(own.map((item) => item.courseId).filter(Boolean));
      const totalAssignments = assignmentRows.filter((item) => courseIds.has(item.courseId));
      const completed = new Set(submissionRows.filter((item) => item.studentId === student.id && courseIds.has(item.courseId)).map((item) => item.assignmentId).filter(Boolean));
      const ownAttendance = attendanceRows.filter((item) => item.studentId === student.id);
      return { ...student, studentId: student.studentId || null, courseNames: [...courseIds].map((id) => courseMap.get(id)?.title || "Course unavailable").join(", ") || null, progress: percent(completed.size, totalAssignments.length), attendance: percent(ownAttendance.filter((item) => ["present", "late"].includes(item.status)).length, ownAttendance.length) };
    });
    return NextResponse.json({ students: rows });
  } catch (error) { return failure("student-list request", error); }
}
async function nextStudentId(db) {
  const ref = db.collection("_counters").doc("students");
  return db.runTransaction(async (transaction) => { const snapshot = await transaction.get(ref); const next = (snapshot.data()?.lastStudentNumber || 0) + 1; transaction.set(ref, { lastStudentNumber: next, updatedAt: FieldValue.serverTimestamp() }, { merge: true }); return `STU-${String(next).padStart(3, "0")}`; });
}
export async function POST(request) {
  let createdUser;
  try {
    const access = await requireManager(request); if (access.denied) return access.denied;
    const { displayName, email, phone, courseId, password } = await request.json(); const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
    if (!displayName?.trim() || !normalizedEmail || !phone?.trim() || !courseId || !password) return NextResponse.json({ message: "Name, email, phone number, course, and password are required." }, { status: 400 });
    if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) return NextResponse.json({ message: "Enter a valid email address." }, { status: 400 });
    if (password.length < 6) return NextResponse.json({ message: "Use a password with at least six characters." }, { status: 400 });
    const course = await access.db.collection("courses").doc(courseId).get(); if (!course.exists) return NextResponse.json({ message: "Choose an existing course." }, { status: 400 });
    const selectedClass = (await access.db.collection("classes").where("courseId", "==", courseId).get()).docs.map(plain).filter((item) => !inactiveClasses.has(item.status)).sort((a, b) => a.id.localeCompare(b.id))[0];
    if (!selectedClass) return NextResponse.json({ message: "This course has no active class available for enrollment." }, { status: 400 });
    createdUser = await access.auth.createUser({ email: normalizedEmail, password, displayName: displayName.trim(), disabled: false });
    try {
      const studentId = await nextStudentId(access.db), now = FieldValue.serverTimestamp(), teacherIds = [...new Set([...(course.data().teacherIds || []), ...(selectedClass.teacherIds || [])])], batch = access.db.batch();
      batch.create(access.db.collection("users").doc(createdUser.uid), { uid: createdUser.uid, studentId, email: createdUser.email || normalizedEmail, displayName: displayName.trim(), phone: phone.trim(), photoURL: "", role: "Student", active: true, teacherIds, createdAt: now, updatedAt: now });
      batch.create(access.db.collection("enrollments").doc(`${courseId}_${createdUser.uid}`), { courseId, classId: selectedClass.id, studentId: createdUser.uid, status: "active", enrolledAt: now, completedAt: null });
      await batch.commit(); return NextResponse.json({ uid: createdUser.uid, studentId }, { status: 201 });
    } catch (error) { try { await access.auth.deleteUser(createdUser.uid); } catch (rollbackError) { console.error("[students-api] rollback failed", { code: rollbackError?.code || "unknown" }); } throw error; }
  } catch (error) {
    const known = { "auth/email-already-exists": "An account already exists for this email.", "auth/invalid-email": "Enter a valid email address.", "auth/invalid-password": "Use a password with at least six characters." };
    return known[error?.code] ? NextResponse.json({ message: known[error.code] }, { status: 400 }) : failure(createdUser ? "student-profile or enrollment creation" : "student-account creation", error);
  }
}
export async function PATCH(request) {
  try {
    const access = await requireManager(request); if (access.denied) return access.denied;
    const { uid, displayName, phone, active } = await request.json(); if (!uid) return NextResponse.json({ message: "Student ID is required." }, { status: 400 });
    const ref = access.db.collection("users").doc(uid), profile = await ref.get(); if (!profile.exists || profile.data().role !== "Student") return NextResponse.json({ message: "Student not found." }, { status: 404 });
    if (typeof displayName === "string" && !displayName.trim()) return NextResponse.json({ message: "Full name is required." }, { status: 400 }); if (typeof phone === "string" && !phone.trim()) return NextResponse.json({ message: "Phone number is required." }, { status: 400 });
    await ref.update({ ...(typeof displayName === "string" ? { displayName: displayName.trim() } : {}), ...(typeof phone === "string" ? { phone: phone.trim() } : {}), ...(typeof active === "boolean" ? { active } : {}), updatedAt: FieldValue.serverTimestamp() });
    if (typeof displayName === "string" || typeof active === "boolean") await access.auth.updateUser(uid, { ...(typeof displayName === "string" ? { displayName: displayName.trim() } : {}), ...(typeof active === "boolean" ? { disabled: !active } : {}) });
    return NextResponse.json({ ok: true });
  } catch (error) { return failure("student-profile update", error); }
}