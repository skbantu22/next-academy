import "server-only";

import { createHmac, randomInt, timingSafeEqual } from "node:crypto";

const CODE_TTL_MS = 10 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;
const RESEND_WINDOW_MS = 60 * 60 * 1000;
const MAX_SENDS_PER_WINDOW = 5;
const MAX_VERIFY_ATTEMPTS = 5;

export class OtpError extends Error {
  constructor(message, status = 400, retryAfterSeconds) {
    super(message);
    this.status = status;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

function otpSecret() {
  const secret = process.env.EMAIL_OTP_HASH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      "EMAIL_OTP_HASH_SECRET must be configured with at least 32 random characters.",
    );
  }
  return secret;
}

export function generateCode() {
  return String(randomInt(100000, 1000000));
}

export function hashCode(code) {
  return createHmac("sha256", otpSecret()).update(code).digest("hex");
}

export function codesMatch(storedHash, suppliedCode) {
  const suppliedHash = hashCode(suppliedCode);
  return timingSafeEqual(
    Buffer.from(storedHash, "hex"),
    Buffer.from(suppliedHash, "hex"),
  );
}

export async function sendOtpEmail(email, code) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !from) {
    throw new Error("Resend email settings are not configured.");
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [email],
      subject: "Your Next Academy verification code",
      text: `Your Next Academy verification code is ${code}. It expires in 10 minutes. Do not share this code with anyone.`,
    }),
  });

  if (!response.ok) {
    throw new Error("Unable to send the verification code.");
  }
}

export async function createAndStoreCode(db, uid) {
  const reference = db.collection("emailOtpVerifications").doc(uid);
  const code = generateCode();
  const now = Date.now();
  const expiresAt = now + CODE_TTL_MS;

  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(reference);
    const current = snapshot.exists ? snapshot.data() : {};
    const lastSentAt = current.lastSentAt || 0;
    const windowStartedAt = current.windowStartedAt || now;
    const inCurrentWindow = now - windowStartedAt < RESEND_WINDOW_MS;
    const sendCount = inCurrentWindow ? current.sendCount || 0 : 0;
    const retryAfterSeconds = Math.ceil(
      Math.max(0, lastSentAt + RESEND_COOLDOWN_MS - now) / 1000,
    );

    if (retryAfterSeconds > 0) {
      throw new OtpError(
        "Please wait before requesting another verification code.",
        429,
        retryAfterSeconds,
      );
    }

    if (sendCount >= MAX_SENDS_PER_WINDOW) {
      throw new OtpError(
        "Too many verification codes requested. Please try again later.",
        429,
        Math.ceil((windowStartedAt + RESEND_WINDOW_MS - now) / 1000),
      );
    }

    transaction.set(
      reference,
      {
        otpHash: hashCode(code),
        expiresAt,
        attempts: 0,
        lastSentAt: now,
        windowStartedAt: inCurrentWindow ? windowStartedAt : now,
        sendCount: sendCount + 1,
      },
      { merge: true },
    );
  });

  return { code, retryAfterSeconds: RESEND_COOLDOWN_MS / 1000 };
}

export async function validateAndConsumeCode(db, uid, code) {
  const reference = db.collection("emailOtpVerifications").doc(uid);
  const now = Date.now();

  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(reference);
    const current = snapshot.exists ? snapshot.data() : null;

    if (!current?.otpHash || !current.expiresAt) {
      throw new OtpError("Invalid verification code.");
    }
    if (now > current.expiresAt) {
      throw new OtpError(
        "Verification code has expired. Please request a new code.",
      );
    }
    if ((current.attempts || 0) >= MAX_VERIFY_ATTEMPTS) {
      throw new OtpError(
        "Too many verification attempts. Please request a new code.",
        429,
      );
    }
    if (!codesMatch(current.otpHash, code)) {
      transaction.update(reference, { attempts: (current.attempts || 0) + 1 });
      throw new OtpError("Invalid verification code.");
    }
  });
}

export async function consumeCode(db, uid, code) {
  const reference = db.collection("emailOtpVerifications").doc(uid);
  const now = Date.now();

  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(reference);
    const current = snapshot.exists ? snapshot.data() : null;
    if (current?.otpHash && codesMatch(current.otpHash, code)) {
      transaction.update(reference, {
        otpHash: null,
        attempts: 0,
        expiresAt: now,
        verifiedAt: now,
      });
    }
  });
}
