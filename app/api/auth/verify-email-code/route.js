import { NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "../../../../lib/firebase-admin";
import {
  consumeCode,
  OtpError,
  validateAndConsumeCode,
} from "../../../../lib/email-otp";

export const runtime = "nodejs";

async function getAuthenticatedUser(request) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) throw new OtpError("Authentication is required.", 401);
  return getAdminAuth().verifyIdToken(token);
}

export async function POST(request) {
  try {
    const { code } = await request.json();
    if (!/^\d{6}$/.test(code || "")) {
      throw new OtpError("Invalid verification code.");
    }

    const decodedToken = await getAuthenticatedUser(request);
    const db = getAdminDb();
    await validateAndConsumeCode(db, decodedToken.uid, code);
    await getAdminAuth().updateUser(decodedToken.uid, { emailVerified: true });
    await consumeCode(db, decodedToken.uid, code);

    return NextResponse.json({ verified: true });
  } catch (error) {
    if (error instanceof OtpError) {
      return NextResponse.json(
        { message: error.message },
        { status: error.status },
      );
    }
    return NextResponse.json(
      { message: "Unable to verify the code. Please try again." },
      { status: 500 },
    );
  }
}
