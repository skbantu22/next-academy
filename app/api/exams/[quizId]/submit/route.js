import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminAuth, getAdminDb } from "../../../../../lib/firebase-admin";
import { checkAndIssueCertificate } from "../../../../../lib/server/certificate-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// The ONLY place a quiz is ever graded — a student's client never sees the
// answer key and never writes quizAttempts directly (see firestore.rules),
// so a score can't be self-reported. Reuses the exact same
// checkAndIssueCertificate() hook the teacher gradebook and attendance
// check-out already call, so a passing quiz score can trigger the same
// automatic course-completion certificate as any other assessment.
export async function POST(request, context) {
  try {
    const { quizId } = await context.params;
    const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    if (!token) return NextResponse.json({ message: "Sign in to continue." }, { status: 401 });
    const db = getAdminDb();
    const decoded = await getAdminAuth().verifyIdToken(token);
    const studentId = decoded.uid;

    const profileSnap = await db.collection("users").doc(studentId).get();
    if (!profileSnap.exists || profileSnap.data().active === false) {
      return NextResponse.json({ message: "Account access is required." }, { status: 403 });
    }

    const quizSnap = await db.collection("quizzes").doc(quizId).get();
    if (!quizSnap.exists) return NextResponse.json({ message: "This exam no longer exists." }, { status: 404 });
    const quiz = quizSnap.data();
    if (quiz.status !== "published") return NextResponse.json({ message: "This exam is not currently open." }, { status: 400 });

    const enrollmentSnap = await db.collection("enrollments").doc(`${quiz.courseId}_${studentId}`).get();
    if (!enrollmentSnap.exists || enrollmentSnap.data().status === "withdrawn") {
      return NextResponse.json({ message: "You are not enrolled in this course." }, { status: 403 });
    }

    const maxAttempts = quiz.maxAttempts > 0 ? quiz.maxAttempts : 1;
    const priorAttempts = await db.collection("quizAttempts").where("quizId", "==", quizId).where("studentId", "==", studentId).get();
    if (priorAttempts.size >= maxAttempts) {
      return NextResponse.json({ message: "You have already used all attempts for this exam." }, { status: 400 });
    }

    const { answers } = await request.json();
    const submitted = answers && typeof answers === "object" ? answers : {};

    const keySnap = await db.collection("quizzes").doc(quizId).collection("answerKey").doc("key").get();
    const key = keySnap.exists ? keySnap.data() : { answers: {}, points: {} };

    let score = 0;
    const maxScore = quiz.totalPoints || 0;
    const perQuestion = (quiz.questions || []).map((question) => {
      const correctOptionIndex = key.answers?.[question.id];
      const pointValue = key.points?.[question.id] || 1;
      const selectedOptionIndex = submitted[question.id];
      const correct = selectedOptionIndex === correctOptionIndex;
      if (correct) score += pointValue;
      return { questionId: question.id, selectedOptionIndex: selectedOptionIndex ?? null, correctOptionIndex, correct };
    });
    const percentage = maxScore ? Math.round((score / maxScore) * 100) : 0;

    const attemptRef = db.collection("quizAttempts").doc();
    const now = FieldValue.serverTimestamp();
    await attemptRef.set({
      quizId,
      quizTitle: quiz.title || "Exam",
      courseId: quiz.courseId,
      teacherId: quiz.teacherId,
      studentId,
      attemptNumber: priorAttempts.size + 1,
      answers: submitted,
      score,
      maxScore,
      percentage,
      perQuestion,
      status: "submitted",
      submittedAt: now,
      createdAt: now,
    });

    // Feed the exact same course-scoring pipeline every other assessment
    // already writes to (lib/server/certificate-core.js's studentCourseScore
    // averages every `assessments` doc for this studentId+courseId) — a
    // quiz score counts toward certificate eligibility with zero extra work.
    const passingScore = maxScore ? Math.round(maxScore * 0.6) : null;
    await db.collection("assessments").add({
      teacherId: quiz.teacherId,
      studentId,
      courseId: quiz.courseId,
      classId: enrollmentSnap.data().classId || "",
      type: "quiz",
      title: quiz.title || "Exam",
      score,
      maxScore,
      passingScore,
      status: passingScore != null && score >= passingScore ? "pass" : "fail",
      createdAt: now,
    });

    await checkAndIssueCertificate(db, { studentId, courseId: quiz.courseId }).catch((error) => {
      console.error("[exam-submit] certificate check failed", { message: error?.message });
    });

    return NextResponse.json({ attemptId: attemptRef.id, score, maxScore, percentage, perQuestion });
  } catch (error) {
    console.error("[exam-submit] failed", { message: error?.message });
    return NextResponse.json({ message: "Unable to submit this exam right now." }, { status: 500 });
  }
}
