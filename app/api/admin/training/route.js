import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminAuth, getAdminDb } from "../../../../lib/firebase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const managers = new Set(["Admin", "Director"]);
const statuses = new Set(["Draft", "Upcoming", "Active", "Completed"]);
const plain = (snapshot) => ({ id: snapshot.id, ...snapshot.data() });
const date = (value) =>
  value?.toDate ? value.toDate().toISOString() : typeof value === "string" ? value : null;
const chunks = (items, size = 30) =>
  Array.from({ length: Math.ceil(items.length / size) }, (_, index) =>
    items.slice(index * size, index * size + size),
  );

function failure(error) {
  console.error("[training-api] assigned-course query failed", {
    code: error?.code || "unknown",
    message: error?.message || "unknown",
  });
  return NextResponse.json(
    { message: "Failed to load your assigned courses." },
    { status: 500 },
  );
}

async function access(request) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token)
    return { denied: NextResponse.json({ message: "Sign in to access training." }, { status: 401 }) };
  const db = getAdminDb();
  const decoded = await getAdminAuth().verifyIdToken(token);
  const profile = await db.collection("users").doc(decoded.uid).get();
  const data = profile.data() || {};
  if (!profile.exists || data.active === false)
    return { denied: NextResponse.json({ message: "You do not have access to training." }, { status: 403 }) };
  return { db, uid: decoded.uid, role: data.role || "" };
}

async function loadRelatedRows(db, courseIds) {
  if (!courseIds.length) return { classes: [], enrollments: [] };
  const groups = await Promise.all(
    chunks(courseIds).map(async (ids) => {
      const [classes, enrollments] = await Promise.all([
        db.collection("classes").where("courseId", "in", ids).get(),
        db.collection("enrollments").where("courseId", "in", ids).get(),
      ]);
      return {
        classes: classes.docs.map(plain),
        enrollments: enrollments.docs.map(plain),
      };
    }),
  );
  return {
    classes: groups.flatMap((group) => group.classes),
    enrollments: groups.flatMap((group) => group.enrollments),
  };
}

async function nextCourseCode(db) {
  const ref = db.collection("_counters").doc("courses");
  return db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    const next = (snapshot.data()?.lastCourseNumber || 0) + 1;
    transaction.set(ref, { lastCourseNumber: next, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    return `TRN-${String(next).padStart(3, "0")}`;
  });
}

// Existing courses were created before Course Codes existed. Backfill them
// once, in creation order, so codes stay stable and unique going forward.
// This only ever adds the missing field — it never touches teacherIds, the
// Firestore document ID, or any other existing data.
async function backfillCourseCodes(db, courses) {
  const missing = courses
    .filter((course) => !course.courseCode)
    .sort((left, right) => (left.createdAt?.toMillis?.() || 0) - (right.createdAt?.toMillis?.() || 0));
  for (const course of missing) {
    const courseCode = await nextCourseCode(db);
    await db.collection("courses").doc(course.id).update({ courseCode });
    course.courseCode = courseCode;
  }
}

async function loadTeachers(db, courses, includeDirectory) {
  if (includeDirectory) {
    const snapshots = await db.collection("users").where("role", "==", "Teacher").get();
    return snapshots.docs.map(plain);
  }
  const teacherIds = [...new Set(courses.flatMap((course) => course.teacherIds || []))];
  if (!teacherIds.length) return [];
  const snapshots = await db.getAll(
    ...teacherIds.map((teacherId) => db.collection("users").doc(teacherId)),
  );
  return snapshots
    .filter((snapshot) => snapshot.exists && snapshot.data().role === "Teacher")
    .map(plain);
}

function courseRow(course, teachers, classes, enrollments) {
  const teacherIds = Array.isArray(course.teacherIds) ? course.teacherIds : [];
  return {
    id: course.id,
    courseCode: course.courseCode || course.id,
    title: course.title || course.name || "",
    description: course.description || "",
    status: course.status || "",
    teacherIds,
    teachers: teacherIds.map((teacherId) => teachers.get(teacherId)).filter(Boolean),
    startDate: date(course.startDate || course.startsAt || course.startAt),
    endDate: date(course.endDate || course.endsAt || course.endAt),
    duration: course.duration || null,
    enrolled: enrollments.filter((entry) => entry.courseId === course.id && entry.status !== "withdrawn").length,
    classCount: classes.filter((entry) => entry.courseId === course.id).length,
    createdAt: date(course.createdAt),
    updatedAt: date(course.updatedAt),
  };
}

async function validateTeachers(db, ids) {
  if (!Array.isArray(ids) || ids.some((id) => typeof id !== "string")) throw new Error("Choose valid teachers.");
  const docs = ids.length ? await db.getAll(...ids.map((id) => db.collection("users").doc(id))) : [];
  if (docs.some((item) => !item.exists || item.data().role !== "Teacher")) throw new Error("Choose only users with the Teacher role.");
  return [...new Set(ids)];
}

function courseFields(body) {
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const description = typeof body.description === "string" ? body.description.trim() : "";
  const status = typeof body.status === "string" ? body.status : "";
  if (!title || title.length > 160) throw new Error("Enter a course title of up to 160 characters.");
  if (description.length > 5000) throw new Error("Description must be 5,000 characters or fewer.");
  if (!statuses.has(status)) throw new Error("Choose a valid course status.");
  return { title, description, status };
}

export async function GET(request) {
  try {
    const a = await access(request);
    if (a.denied) return a.denied;
    let snapshots;
    if (managers.has(a.role)) snapshots = await a.db.collection("courses").get();
    else if (a.role === "Teacher") snapshots = await a.db.collection("courses").where("teacherIds", "array-contains", a.uid).get();
    else return NextResponse.json({ message: "You do not have access to training." }, { status: 403 });

    const courses = snapshots.docs.map(plain);
    if (managers.has(a.role)) await backfillCourseCodes(a.db, courses);
    const courseIds = courses.map((course) => course.id);
    const [teacherRows, related] = await Promise.all([
      loadTeachers(a.db, courses, managers.has(a.role)),
      loadRelatedRows(a.db, courseIds),
    ]);
    const teacherMap = new Map(
      teacherRows.map((teacher) => [
        teacher.id,
        { id: teacher.id, uid: teacher.uid || teacher.id, displayName: teacher.displayName || teacher.name || "", email: teacher.email || "" },
      ]),
    );
    const rows = courses
      .map((course) => courseRow(course, teacherMap, related.classes, related.enrollments))
      .sort((left, right) => left.title.localeCompare(right.title));

    console.info("[training-api] assigned course query", {
      authenticatedUid: a.uid,
      role: a.role,
      queryResultCount: rows.length,
      returnedCourseIds: rows.map((course) => course.id),
      teacherIds: rows.map((course) => course.teacherIds),
      projectId: a.db.projectId,
    });
    return NextResponse.json({
      courses: rows,
      teachers: managers.has(a.role) ? [...teacherMap.values()] : [],
      canManage: managers.has(a.role),
    });
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request) {
  try {
    const a = await access(request);
    if (a.denied) return a.denied;
    if (!managers.has(a.role)) return NextResponse.json({ message: "Administrator access is required." }, { status: 403 });
    const body = await request.json();
    const fields = courseFields(body);
    const teacherIds = await validateTeachers(a.db, body.teacherIds || []);
    const courseCode = await nextCourseCode(a.db);
    const ref = await a.db.collection("courses").add({ ...fields, teacherIds, courseCode, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
    return NextResponse.json({ course: { id: ref.id, courseCode, ...fields, teacherIds } }, { status: 201 });
  } catch (error) {
    return error?.message ? NextResponse.json({ message: error.message }, { status: 400 }) : failure(error);
  }
}

export async function PATCH(request) {
  try {
    const a = await access(request);
    if (a.denied) return a.denied;
    if (!managers.has(a.role)) return NextResponse.json({ message: "Administrator access is required." }, { status: 403 });
    const body = await request.json();
    if (typeof body.id !== "string" || !body.id) return NextResponse.json({ message: "Course ID is required." }, { status: 400 });
    const ref = a.db.collection("courses").doc(body.id);
    if (!(await ref.get()).exists) return NextResponse.json({ message: "Course not found." }, { status: 404 });
    const fields = courseFields(body);
    const teacherIds = await validateTeachers(a.db, body.teacherIds || []);
    await ref.update({ ...fields, teacherIds, updatedAt: FieldValue.serverTimestamp() });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return error?.message ? NextResponse.json({ message: error.message }, { status: 400 }) : failure(error);
  }
}