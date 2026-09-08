import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminAuth, getAdminDb } from "../../../../lib/firebase-admin";
import { signQrToken } from "../../../../lib/qr-token";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function access(request) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token)
    return { denied: NextResponse.json({ message: "Sign in as a teacher to continue." }, { status: 401 }) };
  const db = getAdminDb();
  const decoded = await getAdminAuth().verifyIdToken(token);
  const profile = await db.collection("users").doc(decoded.uid).get();
  const data = profile.data() || {};
  if (!profile.exists || data.active === false || data.role !== "Teacher")
    return { denied: NextResponse.json({ message: "Teacher access is required." }, { status: 403 }) };
  return { db, uid: decoded.uid, profile: data };
}

export async function POST(request) {
  try {
    const a = await access(request);
    if (a.denied) return a.denied;
    const body = await request.json().catch(() => ({}));
    const mode = body.mode === "student" ? "student" : "self";
    const regenerate = Boolean(body.regenerate);

    let targetId = a.uid;
    let targetRef = a.db.collection("users").doc(a.uid);
    let targetData = a.profile;

    if (mode === "student") {
      const studentId = typeof body.studentId === "string" ? body.studentId : "";
      if (!studentId)
        return NextResponse.json({ message: "Student ID is required." }, { status: 400 });
      targetRef = a.db.collection("users").doc(studentId);
      const snapshot = await targetRef.get();
      targetData = snapshot.data() || {};
      if (
        !snapshot.exists ||
        targetData.role !== "Student" ||
        !(targetData.teacherIds || []).includes(a.uid)
      ) {
        return NextResponse.json(
          { message: "You are not authorized to issue a QR code for this student." },
          { status: 403 },
        );
      }
      targetId = studentId;
    }

    let qrVersion = targetData.qrVersion || 0;
    if (regenerate) {
      qrVersion += 1;
      await targetRef.update({ qrVersion, updatedAt: FieldValue.serverTimestamp() });
    }

    const qrToken = signQrToken({
      sub: targetId,
      kind: mode === "student" ? "student" : "teacher",
      v: qrVersion,
    });

    return NextResponse.json({
      token: qrToken,
      qrVersion,
      subject: {
        id: targetId,
        displayName: targetData.displayName || "",
        email: targetData.email || "",
        role: mode === "student" ? "Student" : "Teacher",
      },
    });
  } catch (error) {
    console.error("[qr-token-api] failed", { message: error?.message });
    return NextResponse.json({ message: "Unable to issue a QR code." }, { status: 500 });
  }
}
