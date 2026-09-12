import { readFileSync } from "node:fs";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
const env = {};
for (const line of readFileSync("D:/New folder (2)/nextlms/next-academy/.env.local", "utf8").split(/\r?\n/)) { const m = line.match(/^([A-Z0-9_]+)=(.*)$/); if (m) env[m[1]] = m[2].replace(/^"(.*)"$/, "$1"); }
const app = getApps().length ? getApps()[0] : initializeApp({ credential: cert({ projectId: env.NEXT_PUBLIC_FIREBASE_PROJECT_ID, clientEmail: env.FIREBASE_ADMIN_CLIENT_EMAIL, privateKey: env.FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g, "\n") }) });
const db = getFirestore(app);
const auth = getAuth(app);
const mode = process.argv[2];

const teacher = await auth.getUserByEmail("cal.teach@example.com");
const student = await auth.getUserByEmail("cal.stu@example.com");
const courseId = "6CSsuAj6iVJjPNduFnLD"; // real "Spoken English" course

if (mode === "down") {
  await db.collection("courses").doc(courseId).update({ teacherIds: FieldValue.arrayRemove(teacher.uid) }).catch(() => {});
  await db.collection("enrollments").doc(`${courseId}_${student.uid}`).delete().catch(() => {});
  await db.collection("classes").doc("cal-exam-class").delete().catch(() => {});
  console.log("down");
  process.exit(0);
}

await db.collection("courses").doc(courseId).update({ teacherIds: FieldValue.arrayUnion(teacher.uid), primaryTeacherId: teacher.uid });
await db.collection("classes").doc("cal-exam-class").set({ courseId, name: "Exam Test Class", teacherIds: [teacher.uid], status: "active" }, { merge: true });
await db.collection("enrollments").doc(`${courseId}_${student.uid}`).set({ courseId, classId: "cal-exam-class", studentId: student.uid, status: "active", enrolledAt: FieldValue.serverTimestamp() }, { merge: true });
console.log(JSON.stringify({ teacherUid: teacher.uid, studentUid: student.uid, courseId }));
process.exit(0);
