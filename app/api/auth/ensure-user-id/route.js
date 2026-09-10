import { NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "../../../../lib/firebase-admin";
import { ensureUserId } from "../../../../lib/server/user-id";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Self-scoped only: a caller can ever ensure/read their OWN userId
// (decoded.uid comes from their own verified token), never anyone else's.
// Role-agnostic — replaces the old Student-only /api/auth/ensure-student-id
// now that every role shares one unified User ID scheme (lib/server/
// user-id.js). Only the Admin SDK (server-side) can safely touch the
// `_userIds` uniqueness registry — client Firestore rules deny it entirely.
export async function POST(request) {
  try {
    const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    if (!token) return NextResponse.json({ message: "Sign in to continue." }, { status: 401 });
    const decoded = await getAdminAuth().verifyIdToken(token);
    const db = getAdminDb();
    const userId = await ensureUserId(db, decoded.uid);
    return NextResponse.json({ userId });
  } catch (error) {
    console.error("[ensure-user-id-api] failed", { message: error?.message });
    return NextResponse.json({ message: "Unable to prepare your User ID." }, { status: 500 });
  }
}
