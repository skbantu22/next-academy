import { FieldValue } from "firebase-admin/firestore";

// One unified, role-agnostic User ID for every account — Student, Teacher,
// Director, Volunteer, or any future role — replacing the old per-role
// STU-###/TCH-### schemes (see lib/server/student-id.js, lib/server/
// teacher-id.js — both retained only so historical values on existing
// documents are never touched, per "do not unnecessarily change existing
// IDs"; nothing new is ever minted from them again).
//
// Format: YYYYMMDD (the account's real joined/created date) + a random
// 4-digit suffix, e.g. 202609070713. Unlike the old sequential counters,
// the suffix is random, so uniqueness can't be guaranteed by transaction
// ordering on a single counter doc — instead each candidate is checked
// against a dedicated `_userIds/{id}` registry collection (one doc per
// minted ID, keyed by the ID itself) inside a transaction that only
// commits if that exact ID doesn't already exist, retrying with a fresh
// random suffix on collision. `_userIds/**` is never listed in
// firestore.rules, so it falls through to the catch-all
// `match /{document=**} { allow read, write: if false; }` deny — exactly
// like the existing `_counters/**` collection — meaning only the Admin SDK
// (server) can ever touch it.
const MAX_ATTEMPTS = 20;

function pad2(n) {
  return String(n).padStart(2, "0");
}

// YYYYMMDD from a real Date, using its own local calendar date — never
// "today" for a backfilled legacy account, since the ID must always
// reflect the account's actual joined/created date.
function datePrefix(date) {
  return `${date.getFullYear()}${pad2(date.getMonth() + 1)}${pad2(date.getDate())}`;
}

function randomSuffix() {
  return String(Math.floor(Math.random() * 10000)).padStart(4, "0");
}

export async function generateUserId(db, joinedDate = new Date()) {
  const prefix = datePrefix(joinedDate);
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const candidate = `${prefix}${randomSuffix()}`;
    const registryRef = db.collection("_userIds").doc(candidate);
    const claimed = await db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(registryRef);
      if (snapshot.exists) return false;
      transaction.set(registryRef, { createdAt: FieldValue.serverTimestamp() });
      return true;
    });
    if (claimed) return candidate;
  }
  throw new Error("Unable to generate a unique User ID after multiple attempts. Please try again.");
}

// Idempotent, mirrors ensureStudentCode's shape: no-op if the account
// already has a userId (old or new — "existing users keep their existing
// User ID if one already exists"); otherwise mints one using the
// account's own createdAt (falling back to now only if createdAt is
// somehow missing, e.g. still mid-write via a serverTimestamp sentinel).
// Safe to call repeatedly (every login, every admin list load, etc.).
export async function ensureUserId(db, uid) {
  const ref = db.collection("users").doc(uid);
  const snapshot = await ref.get();
  if (!snapshot.exists) return null;
  const data = snapshot.data();
  if (data.userId) return data.userId;
  const joinedDate = data.createdAt?.toDate?.() || new Date();
  const userId = await generateUserId(db, joinedDate);
  await ref.update({ userId, updatedAt: FieldValue.serverTimestamp() });
  return userId;
}
