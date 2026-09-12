import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { updateProfile as updateAuthProfile } from "firebase/auth";
import { auth, db } from "./firebase";

function reportQueryError(
  error,
  { collectionName, queryDescription, teacherId, onError },
) {
  console.error(`[teacher-data] ${collectionName} query failed`, {
    error,
    name: error?.name,
    code: error?.code,
    message: error?.message,
    stack: error?.stack,
    teacherId,
    collection: collectionName,
    query: queryDescription,
  });
  onError(error, collectionName);
}

function ordered(snapshot) {
  return snapshot.docs
    .map((item) => ({ id: item.id, ...item.data() }))
    .sort((a, b) =>
      String(
        b.createdAt?.toMillis?.() || b.updatedAt?.toMillis?.() || b.date || "",
      ).localeCompare(
        String(
          a.createdAt?.toMillis?.() ||
            a.updatedAt?.toMillis?.() ||
            a.date ||
            "",
        ),
      ),
    );
}

export function subscribeTeacherCollection(
  name,
  teacherId,
  onData,
  onError,
  field = "teacherId",
) {
  if (!db || !teacherId) return () => {};
  const queryDescription = `collection(${name}) where ${field} == ${teacherId}`;
  const ref = query(collection(db, name), where(field, "==", teacherId));
  return onSnapshot(
    ref,
    (snapshot) => onData(ordered(snapshot)),
    (error) =>
      reportQueryError(error, {
        collectionName: name,
        queryDescription,
        teacherId,
        onError,
      }),
  );
}

export function subscribeTeacherClasses(teacherId, onData, onError) {
  if (!db || !teacherId) return () => {};
  return onSnapshot(
    query(
      collection(db, "classes"),
      where("teacherIds", "array-contains", teacherId),
    ),
    (snapshot) => onData(ordered(snapshot)),
    (error) =>
      reportQueryError(error, {
        collectionName: "classes",
        queryDescription: `collection(classes) where teacherIds array-contains ${teacherId}`,
        teacherId,
        onError,
      }),
  );
}

export function subscribeTeacherCourses(teacherId, onData, onError) {
  if (!db || !teacherId) return () => {};
  return onSnapshot(
    query(
      collection(db, "courses"),
      where("teacherIds", "array-contains", teacherId),
    ),
    (snapshot) => {
      const courses = ordered(snapshot);
      console.info("[teacher-data] assigned course query", {
        teacherId,
        count: courses.length,
        courseIds: courses.map((course) => course.id),
        teacherIds: courses.map((course) => course.teacherIds || []),
      });
      onData(courses);
    },
    (error) =>
      reportQueryError(error, {
        collectionName: "courses",
        queryDescription: `collection(courses) where teacherIds array-contains ${teacherId}`,
        teacherId,
        onError,
      }),
  );
}

export function subscribeTeacherCourse(teacherId, courseId, onData, onError) {
  if (!db || !teacherId || !courseId) return () => {};
  return onSnapshot(
    doc(db, "courses", courseId),
    (snapshot) => {
      if (!snapshot.exists()) {
        onError(new Error("Course not found."), "courses");
        return;
      }
      const course = { id: snapshot.id, ...snapshot.data() };
      if (!course.teacherIds?.includes(teacherId)) {
        onError(
          new Error("This course is not assigned to the current teacher."),
          "courses",
        );
        return;
      }
      onData(course);
    },
    (error) =>
      reportQueryError(error, {
        collectionName: "courses",
        queryDescription: `doc(courses/${courseId}) assigned to ${teacherId}`,
        teacherId,
        onError,
      }),
  );
}

export function subscribeTeacherCourseClasses(
  teacherId,
  courseId,
  onData,
  onError,
) {
  if (!db || !teacherId || !courseId) return () => {};
  return onSnapshot(
    query(
      collection(db, "classes"),
      where("teacherIds", "array-contains", teacherId),
    ),
    (snapshot) =>
      onData(ordered(snapshot).filter((item) => item.courseId === courseId)),
    (error) =>
      reportQueryError(error, {
        collectionName: "classes",
        queryDescription: `collection(classes) where teacherIds array-contains ${teacherId} and courseId == ${courseId}`,
        teacherId,
        onError,
      }),
  );
}

export function subscribeTeacherCourseAttendance(
  teacherId,
  courseId,
  onData,
  onError,
) {
  if (!db || !teacherId || !courseId) return () => {};
  return onSnapshot(
    query(
      collection(db, "attendance"),
      where("teacherId", "==", teacherId),
      where("courseId", "==", courseId),
    ),
    (snapshot) => onData(ordered(snapshot)),
    (error) =>
      reportQueryError(error, {
        collectionName: "attendance",
        queryDescription: `collection(attendance) where teacherId == ${teacherId} and courseId == ${courseId}`,
        teacherId,
        onError,
      }),
  );
}

export function subscribeTeacherStudent(teacherId, studentId, onData, onError) {
  if (!db || !teacherId || !studentId) return () => {};
  return onSnapshot(
    doc(db, "users", studentId),
    (snapshot) => {
      if (!snapshot.exists()) {
        onError(new Error("Student not found."), "users");
        return;
      }
      const student = { id: snapshot.id, ...snapshot.data() };
      if (student.role !== "Student" || !(student.teacherIds || []).includes(teacherId)) {
        onError(
          new Error("This student is not assigned to the current teacher."),
          "users",
        );
        return;
      }
      onData(student);
    },
    (error) =>
      reportQueryError(error, {
        collectionName: "users",
        queryDescription: `doc(users/${studentId}) assigned to ${teacherId}`,
        teacherId,
        onError,
      }),
  );
}

export function subscribeTeacherStudentAttendance(
  teacherId,
  studentId,
  onData,
  onError,
) {
  if (!db || !teacherId || !studentId) return () => {};
  return onSnapshot(
    query(
      collection(db, "attendance"),
      where("teacherId", "==", teacherId),
      where("studentId", "==", studentId),
    ),
    (snapshot) => onData(ordered(snapshot)),
    (error) =>
      reportQueryError(error, {
        collectionName: "attendance",
        queryDescription: `collection(attendance) where teacherId == ${teacherId} and studentId == ${studentId}`,
        teacherId,
        onError,
      }),
  );
}

export function subscribeTeacherStudentAchievements(
  teacherId,
  studentId,
  onData,
  onError,
) {
  if (!db || !teacherId || !studentId) return () => {};
  return onSnapshot(
    query(
      collection(db, "achievements"),
      where("teacherId", "==", teacherId),
      where("studentId", "==", studentId),
    ),
    (snapshot) => onData(ordered(snapshot)),
    (error) =>
      reportQueryError(error, {
        collectionName: "achievements",
        queryDescription: `collection(achievements) where teacherId == ${teacherId} and studentId == ${studentId}`,
        teacherId,
        onError,
      }),
  );
}

export function subscribeTeacherStudentCertificates(
  teacherId,
  studentId,
  onData,
  onError,
) {
  if (!db || !teacherId || !studentId) return () => {};
  return onSnapshot(
    query(
      collection(db, "certificates"),
      where("teacherId", "==", teacherId),
      where("studentId", "==", studentId),
    ),
    (snapshot) => onData(ordered(snapshot)),
    (error) =>
      reportQueryError(error, {
        collectionName: "certificates",
        queryDescription: `collection(certificates) where teacherId == ${teacherId} and studentId == ${studentId}`,
        teacherId,
        onError,
      }),
  );
}

export async function listClassEnrollments(classId) {
  if (!db || !classId) return [];
  const snapshot = await getDocs(
    query(collection(db, "enrollments"), where("classId", "==", classId)),
  );
  return ordered(snapshot);
}

export function subscribeTeacherAssignments(teacherId, onData, onError) {
  return subscribeTeacherCollection("assignments", teacherId, onData, onError);
}

export function subscribeTeacherConversations(teacherId, onData, onError) {
  if (!db || !teacherId) return () => {};
  return onSnapshot(
    query(
      collection(db, "conversations"),
      where("participantIds", "array-contains", teacherId),
    ),
    (snapshot) => onData(ordered(snapshot)),
    (error) =>
      reportQueryError(error, {
        collectionName: "conversations",
        queryDescription: `collection(conversations) where participantIds array-contains ${teacherId}`,
        teacherId,
        onError,
      }),
  );
}
export function subscribeTeacherStudents(teacherId, onData, onError) {
  if (!db || !teacherId) return () => {};
  return onSnapshot(
    query(
      collection(db, "users"),
      where("role", "==", "Student"),
      where("teacherIds", "array-contains", teacherId),
    ),
    (snapshot) => onData(ordered(snapshot)),
    (error) => {
      reportQueryError(error, {
        collectionName: "users",
        queryDescription: `collection(users) where role == Student and teacherIds array-contains ${teacherId}`,
        teacherId,
        onError,
      });
    },
  );
}

export function subscribeTeacherNotifications(teacherId, onData, onError) {
  return subscribeTeacherCollection(
    "notifications",
    teacherId,
    onData,
    onError,
    "userId",
  );
}

export async function markNotificationRead(notificationId) {
  if (!db) throw new Error("Firebase is not configured.");
  await updateDoc(doc(db, "notifications", notificationId), {
    readAt: serverTimestamp(),
  });
}

export async function updateTeacherProfile(uid, fields) {
  if (!db) throw new Error("Firebase is not configured.");
  await updateDoc(doc(db, "users", uid), fields);
  // Mirror onto the Firebase Auth user record too — see
  // lib/profile-data.js's updateMyProfile for why (kept in sync, same
  // best-effort/non-fatal treatment).
  if (auth?.currentUser?.uid === uid && ("displayName" in fields || "photoURL" in fields)) {
    try {
      await updateAuthProfile(auth.currentUser, {
        ...("displayName" in fields ? { displayName: fields.displayName || null } : {}),
        ...("photoURL" in fields ? { photoURL: fields.photoURL || null } : {}),
      });
    } catch {
      // Non-fatal — the Firestore profile already saved successfully above.
    }
  }
}

export function subscribeTeacherDashboard(teacherId, handlers) {
  const unsubscribers = [
    subscribeTeacherClasses(teacherId, handlers.classes, handlers.error),
    subscribeTeacherStudents(teacherId, handlers.students, handlers.error),
    subscribeTeacherCourses(teacherId, handlers.courses, handlers.error),
    subscribeTeacherAssignments(
      teacherId,
      handlers.assignments,
      handlers.error,
    ),
    subscribeTeacherCollection(
      "submissions",
      teacherId,
      handlers.submissions,
      handlers.error,
    ),
    subscribeTeacherCollection(
      "attendance",
      teacherId,
      handlers.attendance,
      handlers.error,
    ),
    subscribeTeacherCollection(
      "events",
      teacherId,
      handlers.events,
      handlers.error,
    ),
    subscribeTeacherCollection(
      "activities",
      teacherId,
      handlers.activities,
      handlers.error,
    ),
    subscribeTeacherCollection(
      "achievements",
      teacherId,
      handlers.achievements,
      handlers.error,
    ),
    subscribeTeacherCollection(
      "certificates",
      teacherId,
      handlers.certificates,
      handlers.error,
    ),
    subscribeTeacherConversations(
      teacherId,
      handlers.conversations,
      handlers.error,
    ),
    subscribeTeacherNotifications(
      teacherId,
      handlers.notifications,
      handlers.error,
    ),
  ];
  return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
}

export function subscribeConversationMessages(conversationId, onData, onError) {
  if (!db || !conversationId) return () => {};
  return onSnapshot(
    query(collection(db, "conversations", conversationId, "messages")),
    (snapshot) => onData(ordered(snapshot)),
    onError,
  );
}

export async function listCourseModules(courseId) {
  if (!db || !courseId) return [];
  const snapshot = await getDocs(
    collection(db, "courses", courseId, "modules"),
  );
  return ordered(snapshot);
}

export async function createTeacherEvent(teacherId, event) {
  if (!db) throw new Error("Firebase is not configured.");
  const ref = await addDoc(collection(db, "events"), {
    ...event,
    teacherId,
    status: "scheduled",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  await addDoc(collection(db, "activities"), {
    actorId: teacherId,
    teacherId,
    type: "event.created",
    title: "Event created",
    description: event.title,
    entityId: ref.id,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateTeacherEvent(eventId, teacherId, event) {
  if (!db) throw new Error("Firebase is not configured.");
  await updateDoc(doc(db, "events", eventId), {
    ...event,
    teacherId,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteTeacherEvent(eventId) {
  if (!db) throw new Error("Firebase is not configured.");
  await deleteDoc(doc(db, "events", eventId));
}

export async function saveAttendance(teacherId, records) {
  if (!db) throw new Error("Firebase is not configured.");
  const batch = writeBatch(db);
  records.forEach((record) =>
    batch.set(
      doc(
        db,
        "attendance",
        record.id || `${record.classId}_${record.studentId}_${record.date}`,
      ),
      {
        ...record,
        teacherId,
        markedBy: teacherId,
        markedAt: serverTimestamp(),
      },
      { merge: true },
    ),
  );
  await batch.commit();
  await addDoc(collection(db, "activities"), {
    actorId: teacherId,
    teacherId,
    type: "attendance.marked",
    title: "Attendance marked",
    description: `${records.length} attendance records updated`,
    createdAt: serverTimestamp(),
  });
}

export async function sendTeacherMessage(
  teacherId,
  conversationId,
  receiverId,
  body,
) {
  if (!db) throw new Error("Firebase is not configured.");
  const messageRef = await addDoc(
    collection(db, "conversations", conversationId, "messages"),
    {
      senderId: teacherId,
      receiverId,
      body,
      createdAt: serverTimestamp(),
      readAt: null,
    },
  );
  await updateDoc(doc(db, "conversations", conversationId), {
    lastMessage: body,
    lastMessageAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  await addDoc(collection(db, "notifications"), {
    userId: receiverId,
    type: "message",
    title: "New message",
    body,
    entityId: messageRef.id,
    readAt: null,
    createdAt: serverTimestamp(),
  });
  return messageRef.id;
}

// Called right after attendance/assessment writes succeed (see
// AttendanceView and the gradebook view in TeacherWorkspacePage.js) to
// re-derive certificate eligibility from the data that was just saved —
// never a student-initiated request. Failures are swallowed by callers
// (a certificate check must never block the attendance/score save it
// follows); see app/api/teacher/certificates/check/route.js's header for
// why this is a dedicated route rather than a Cloud Function trigger.
export async function checkCertificateEligibility(studentId, courseId) {
  const token = await auth?.currentUser?.getIdToken();
  if (!token || !studentId || !courseId) return;
  await fetch("/api/teacher/certificates/check", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ studentId, courseId }),
  }).catch(() => {});
}

export async function createTeacherAchievement(teacherId, achievement) {
  if (!db) throw new Error("Firebase is not configured.");
  const ref = await addDoc(collection(db, "achievements"), {
    ...achievement,
    teacherId,
    status: "awarded",
    awardedAt: serverTimestamp(),
  });
  await addDoc(collection(db, "activities"), {
    actorId: teacherId,
    teacherId,
    type: "achievement.created",
    title: "Achievement awarded",
    description: achievement.title,
    entityId: ref.id,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function createTeacherCertificate(teacherId, certificate) {
  if (!db) throw new Error("Firebase is not configured.");
  const ref = await addDoc(collection(db, "certificates"), {
    ...certificate,
    teacherId,
    status: "issued",
    issueDate: serverTimestamp(),
  });
  await updateDoc(ref, { certificateId: ref.id });
  return ref.id;
}
