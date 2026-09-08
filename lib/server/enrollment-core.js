import { FieldValue } from "firebase-admin/firestore";
import { effectiveCapacity } from "../enrollment";
import { ensureStudentCode } from "./student-id";
import { computeStatus } from "./payment-core";

const plain = (snapshot) => ({ id: snapshot.id, ...snapshot.data() });
const date = (value) => (value?.toDate ? value.toDate().toISOString() : typeof value === "string" ? value : null);

// Shared by both /api/admin/enrollments (Admin/Director) and
// /api/teacher/enrollments (assigned Teacher). Each route applies its own
// authorization gate before calling into this module — nothing here decides
// *who* is allowed, only what a permitted caller can see/do.

// Courses created before the auto-class-creation logic existed (e.g.
// legacy TRN-001/TRN-002 style records) can have teacherIds but no linked
// class at all. Rather than permanently blocking Students/Attendance for
// them, self-heal once: reuse an existing class for this course if one
// happens to exist, otherwise create the missing class now (same shape
// Phase 0 already creates for new trainings) and link it back onto the
// course via primaryClassId. Runs at most once per legacy course.
async function ensurePrimaryClass(db, courseId, course) {
  if (course.primaryClassId) {
    const classSnap = await db.collection("classes").doc(course.primaryClassId).get();
    if (classSnap.exists) return plain(classSnap);
  }
  const existing = await db.collection("classes").where("courseId", "==", courseId).limit(1).get();
  let classDoc;
  if (!existing.empty) {
    classDoc = plain(existing.docs[0]);
  } else {
    const ref = await db.collection("classes").add({
      courseId,
      name: course.batchName || course.title || "Batch",
      teacherIds: course.teacherIds || [],
      campus: course.campus || "",
      building: course.building || "",
      room: course.room || "",
      floor: course.floor || "",
      startDate: course.startDate || "",
      endDate: course.endDate || "",
      startTime: course.startTime || "",
      endTime: course.endTime || "",
      maxStudents: course.maxStudents ?? null,
      status: "active",
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    classDoc = { id: ref.id, courseId };
  }
  await db.collection("courses").doc(courseId).update({ primaryClassId: classDoc.id });
  return classDoc;
}

export async function loadCourseAndClass(db, courseId) {
  const courseSnap = await db.collection("courses").doc(courseId).get();
  if (!courseSnap.exists) return { error: { status: 404, message: "Training not found." } };
  const course = plain(courseSnap);
  const classDoc = await ensurePrimaryClass(db, courseId, course);
  if (!course.primaryClassId) course.primaryClassId = classDoc.id;
  return { course, classDoc };
}

export async function activeEnrollmentsForClass(db, classId) {
  const snapshot = await db.collection("enrollments").where("classId", "==", classId).get();
  return snapshot.docs.map(plain).filter((item) => item.status !== "withdrawn");
}

// includePayments=false strips fee/payment fields from the response
// entirely (not just hidden in the UI) — used by /api/teacher/enrollments,
// since Teacher must not have access to financial/payment information.
export async function buildEnrollmentsPayload(db, course, classDoc, { includePayments = true } = {}) {
  const [activeEnrollments, studentsSnapshot] = await Promise.all([
    activeEnrollmentsForClass(db, course.primaryClassId),
    db.collection("users").where("role", "==", "Student").get(),
  ]);

  const studentIds = activeEnrollments.map((item) => item.studentId);
  const studentDocs = studentIds.length
    ? await db.getAll(...studentIds.map((id) => db.collection("users").doc(id)))
    : [];
  const studentMap = new Map(studentDocs.filter((doc) => doc.exists).map((doc) => [doc.id, plain(doc)]));

  // The Firebase UID must never reach the UI as a "Student ID" — backfill
  // any student who's still missing their human-readable STU-### the
  // moment they'd otherwise be displayed here (belt-and-suspenders on top
  // of the login-time self-heal in lib/auth-context.js).
  const allStudentRows = studentsSnapshot.docs.map(plain);
  await Promise.all(
    allStudentRows
      .filter((student) => !student.studentId)
      .map((student) => ensureStudentCode(db, student.id).then((code) => { student.studentId = code; })),
  );
  for (const student of studentMap.values()) {
    if (!student.studentId) {
      const fresh = allStudentRows.find((row) => row.id === student.id);
      if (fresh?.studentId) student.studentId = fresh.studentId;
    }
  }

  const enrollments = activeEnrollments
    .map((item) => {
      const student = studentMap.get(item.studentId);
      if (!student) return null;
      // Legacy enrollments created before pricing existed have none of
      // these fields — default to a zero-fee, already-settled admission
      // rather than crashing or showing garbage numbers.
      const trainingFee = Number(item.trainingFee) || 0;
      const discount = Number(item.discount) || 0;
      const finalFee = Number.isFinite(item.finalFee) ? item.finalFee : Math.max(0, trainingFee - discount);
      const totalPaid = Number(item.totalPaid) || 0;
      const dueAmount = Number.isFinite(item.dueAmount) ? item.dueAmount : Math.max(0, finalFee - totalPaid);
      const base = {
        enrollmentId: `${item.courseId}_${item.studentId}`,
        studentId: item.studentId,
        studentCode: student.studentId || "—",
        displayName: student.displayName || "",
        email: student.email || "",
        phone: student.phone || "",
        active: student.active !== false,
        status: item.status,
        enrolledAt: date(item.enrolledAt),
      };
      if (!includePayments) return base;
      return {
        ...base,
        trainingFee,
        discount,
        finalFee,
        totalPaid,
        dueAmount,
        paymentStatus: item.paymentStatus || computeStatus(finalFee, totalPaid),
        currency: item.currency || "SGD",
      };
    })
    .filter(Boolean)
    .sort((left, right) => (left.displayName || "").localeCompare(right.displayName || ""));

  const enrolledIds = new Set(enrollments.map((item) => item.studentId));
  const allStudents = allStudentRows
    .filter((student) => student.active !== false)
    .map((student) => ({
      id: student.id,
      studentCode: student.studentId || "—",
      displayName: student.displayName || "",
      email: student.email || "",
      alreadyEnrolled: enrolledIds.has(student.id),
    }))
    .sort((left, right) => (left.displayName || "").localeCompare(right.displayName || ""));

  const capacity = effectiveCapacity(classDoc.maxStudents ?? course.maxStudents, course.seatCapacity);
  return { enrollments, allStudents, enrolledCount: enrollments.length, capacity, classId: course.primaryClassId };
}

// Runs the full validation chain (student exists -> active -> not already
// enrolled -> capacity available) and creates/reactivates the enrollment.
// Returns a plain {status, body} result — never throws for expected
// validation failures, only for genuine unexpected errors.
export async function createEnrollment(db, course, classDoc, studentId) {
  const studentSnap = await db.collection("users").doc(studentId).get();
  if (!studentSnap.exists || studentSnap.data().role !== "Student") {
    return { status: 400, body: { message: "Choose a valid student." } };
  }
  if (studentSnap.data().active === false) {
    return { status: 400, body: { message: "This student account is inactive." } };
  }

  const classId = course.primaryClassId;
  const activeEnrollments = await activeEnrollmentsForClass(db, classId);
  const capacity = effectiveCapacity(classDoc.maxStudents ?? course.maxStudents, course.seatCapacity);

  const enrollmentRef = db.collection("enrollments").doc(`${course.id}_${studentId}`);
  const existing = await enrollmentRef.get();
  const alreadyActive = existing.exists && existing.data().status !== "withdrawn";
  if (alreadyActive) {
    return { status: 409, body: { message: "This student is already enrolled in this training." } };
  }

  if (capacity != null && activeEnrollments.length >= capacity) {
    return { status: 409, body: { message: "This training is full. No more students can be enrolled." } };
  }

  // Snapshot the course's fee/discount at admission time — later price
  // changes on the course must not silently change what an already-enrolled
  // student owes.
  const trainingFee = Number(course.price) || 0;
  const discount = Math.min(Number(course.discountPrice) || 0, trainingFee);
  const finalFee = Math.max(0, trainingFee - discount);

  const now = FieldValue.serverTimestamp();
  await enrollmentRef.set(
    {
      courseId: course.id,
      classId,
      studentId,
      status: "active",
      enrolledAt: now,
      completedAt: null,
      trainingFee,
      discount,
      finalFee,
      totalPaid: 0,
      dueAmount: finalFee,
      paymentStatus: computeStatus(finalFee, 0),
      currency: "SGD",
    },
    { merge: true },
  );
  if (Array.isArray(course.teacherIds) && course.teacherIds.length) {
    await db.collection("users").doc(studentId).update({
      teacherIds: FieldValue.arrayUnion(...course.teacherIds),
      updatedAt: now,
    });
  }

  await db.collection("notifications").add({
    userId: studentId,
    type: "enrollment",
    title: "Enrolled in a new training",
    body: `You have been enrolled in ${course.title || "a training program"}.`,
    entityId: enrollmentRef.id,
    actionUrl: null,
    readAt: null,
    createdAt: FieldValue.serverTimestamp(),
  });

  return { status: 201, body: { ok: true, enrolledCount: activeEnrollments.length + 1, capacity } };
}

export async function removeEnrollment(db, courseId, studentId) {
  const ref = db.collection("enrollments").doc(`${courseId}_${studentId}`);
  const snapshot = await ref.get();
  if (!snapshot.exists) return { status: 404, body: { message: "Enrollment not found." } };
  if (snapshot.data().status === "withdrawn") return { status: 200, body: { ok: true } };
  await ref.update({ status: "withdrawn", withdrawnAt: FieldValue.serverTimestamp() });
  return { status: 200, body: { ok: true } };
}
