import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

const DEFAULT_TTL_MS = 180 * 24 * 60 * 60 * 1000; // 180 days — printed physical cards.

export class QrTokenError extends Error {
  constructor(message, code) {
    super(message);
    this.code = code;
  }
}

function secret() {
  const value = process.env.QR_TOKEN_SECRET;
  if (!value || value.length < 32) {
    throw new Error(
      "QR_TOKEN_SECRET must be configured with at least 32 random characters.",
    );
  }
  return value;
}

function base64url(input) {
  return Buffer.from(input).toString("base64url");
}

function sign(payloadEncoded) {
  return createHmac("sha256", secret()).update(payloadEncoded).digest("base64url");
}

export function signQrToken({ sub, kind, v = 0, ttlMs = DEFAULT_TTL_MS }) {
  const payload = { sub, kind, v, exp: Date.now() + ttlMs };
  const payloadEncoded = base64url(JSON.stringify(payload));
  return `${payloadEncoded}.${sign(payloadEncoded)}`;
}

export function verifyQrToken(token) {
  if (typeof token !== "string" || !token.includes(".")) {
    throw new QrTokenError("Invalid QR code.", "invalid");
  }
  const [payloadEncoded, signature] = token.split(".");
  if (!payloadEncoded || !signature) {
    throw new QrTokenError("Invalid QR code.", "invalid");
  }

  const expected = sign(payloadEncoded);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new QrTokenError("Invalid QR code.", "invalid");
  }

  let payload;
  try {
    payload = JSON.parse(Buffer.from(payloadEncoded, "base64url").toString("utf8"));
  } catch {
    throw new QrTokenError("Invalid QR code.", "invalid");
  }

  if (!payload?.sub || !payload?.kind || typeof payload.exp !== "number") {
    throw new QrTokenError("Invalid QR code.", "invalid");
  }
  if (Date.now() > payload.exp) {
    throw new QrTokenError("This QR code has expired.", "expired");
  }
  return payload;
}
