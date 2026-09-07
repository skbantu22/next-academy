import { NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "../../../../lib/firebase-admin";
import {
  createAndStoreCode,
  OtpError,
  sendOtpEmail,
} from "../../../../lib/email-otp";

export const runtime = "nodejs";

async function getAuthenticatedUser(request) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) throw new OtpError("Authentication is required.", 401);
  return getAdminAuth().verifyIdToken(token);
}

export async function POST(request) {
  try {
    const decodedToken = await getAuthenticatedUser(request);
    const user = await getAdminAuth().getUser(decodedToken.uid);
    if (user.emailVerified) {
      return NextResponse.json({ message: "Email is already verified." });
    }
    if (!user.email) {
      throw new OtpError("This account does not have an email address.");
    }

    const { code, retryAfterSeconds } = await createAndStoreCode(
      getAdminDb(),
      user.uid,
    );
    await sendOtpEmail(user.email, code);

    return NextResponse.json({ retryAfterSeconds });
  } catch (error) {
    if (error instanceof OtpError) {
      return NextResponse.json(
        {
          message: error.message,
          retryAfterSeconds: error.retryAfterSeconds,
        },
        { status: error.status },
      );
    }
    return NextResponse.json(
      { message: "Unable to send the verification code. Please try again." },
      { status: 500 },
    );
  }
}
