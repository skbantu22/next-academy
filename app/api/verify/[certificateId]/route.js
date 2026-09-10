import { NextResponse } from "next/server";
import { getAdminDb } from "../../../../lib/firebase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Public certificate verification — no auth required, mirrors the
// Admin-SDK-proxy pattern already used by app/api/promote/[slug] since
// certificates has no public Firestore read rule (and shouldn't get one —
// this route deliberately returns only the minimum fields a verifier
// needs, never the full record). `certificateId` here is either the
// document id or the permanent human-readable certificateCode — both are
// accepted since either could be printed/QR-encoded on the certificate.
export async function GET(_request, context) {
  try {
    const { certificateId } = await context.params;
    const db = getAdminDb();
    if (!certificateId) return NextResponse.json({ result: "not_found" }, { status: 404 });

    let snapshot = await db.collection("certificates").doc(certificateId).get();
    if (!snapshot.exists) {
      const bySlug = await db.collection("certificates").where("certificateCode", "==", certificateId).limit(1).get();
      if (!bySlug.empty) snapshot = bySlug.docs[0];
    }
    if (!snapshot.exists) {
      return NextResponse.json({ result: "not_found" });
    }

    const cert = snapshot.data();
    const [studentSnap, courseSnap] = await Promise.all([
      cert.studentId ? db.collection("users").doc(cert.studentId).get() : null,
      cert.courseId ? db.collection("courses").doc(cert.courseId).get() : null,
    ]);
    const student = studentSnap?.exists ? studentSnap.data() : {};
    const course = courseSnap?.exists ? courseSnap.data() : {};

    const base = {
      certificateId: cert.certificateCode || snapshot.id,
      studentName: student.displayName || cert.metadata?.studentName || "",
      courseName: course.title || cert.metadata?.courseName || "",
      issueDate: cert.issueDate?.toDate?.().toISOString().slice(0, 10) || cert.metadata?.completionDate || "",
      certificateType: cert.type || "",
    };

    if (cert.status === "revoked") {
      return NextResponse.json({ result: "revoked", ...base });
    }
    return NextResponse.json({ result: "valid", ...base });
  } catch (error) {
    console.error("[verify-api] failed", { message: error?.message });
    return NextResponse.json({ result: "not_found" }, { status: 500 });
  }
}
