import { NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "../../../../lib/firebase-admin";
import { ensureStudentCode } from "../../../../lib/server/student-id";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Self-scoped only: a caller can ever ensure/read their OWN studentId
// (decoded.uid comes from their own verified token), never anyone else's.
// This is what backfills the human-readable STU-### for self-registered
// students, since only the Admin SDK (server-side) can safely touch the
// shared _counters/students transaction — client Firestore rules deny it.
export async function POST(request) {
  try {
    const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    if (!token) return NextResponse.json({ message: "Sign in to continue." }, { status: 401 });
    const decoded = await getAdminAuth().verifyIdToken(token);
    const db = getAdminDb();
    const studentId = await ensureStudentCode(db, decoded.uid);
    return NextResponse.json({ studentId });
  } catch (error) {
    console.error("[ensure-student-id-api] failed", { message: error?.message });
    return NextResponse.json({ message: "Unable to prepare your student ID." }, { status: 500 });
  }
}
