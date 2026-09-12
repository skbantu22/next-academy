// _tmp-verify-setup.mjs
import { readFileSync } from "node:fs";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
var env = {};
for (const line of readFileSync("D:/New folder (2)/nextlms/next-academy/.env.local", "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].replace(/^"(.*)"$/, "$1");
}
var app = getApps().length ? getApps()[0] : initializeApp({ credential: cert({ projectId: env.NEXT_PUBLIC_FIREBASE_PROJECT_ID, clientEmail: env.FIREBASE_ADMIN_CLIENT_EMAIL, privateKey: env.FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g, "\n") }) });
var db = getFirestore(app);
var auth = getAuth(app);
var mode = process.argv[2];
var EMAILS = ["ve.newstudent@example.com", "ve.oldunverified@example.com", "ve.verified@example.com"];
if (mode === "down") {
  for (const e of EMAILS) {
    try {
      const u2 = await auth.getUserByEmail(e);
      await auth.deleteUser(u2.uid);
      await db.collection("users").doc(u2.uid).delete();
    } catch {
    }
  }
  console.log("down");
  process.exit(0);
}
if (mode === "genlink") {
  const email = process.argv[3];
  const link = await auth.generateEmailVerificationLink(email, { url: "http://localhost:3000/verify-email", handleCodeInApp: true });
  const oobCode = new URL(link).searchParams.get("oobCode");
  console.log(JSON.stringify({ link, oobCode }));
  process.exit(0);
}
if (mode === "isverified") {
  const email = process.argv[3];
  const u2 = await auth.getUserByEmail(email);
  console.log(JSON.stringify({ emailVerified: u2.emailVerified }));
  process.exit(0);
}
var u;
try {
  u = await auth.getUserByEmail("ve.oldunverified@example.com");
} catch {
  u = await auth.createUser({ email: "ve.oldunverified@example.com", password: "Test123456!", emailVerified: false, displayName: "VE Old Unverified" });
}
await db.collection("users").doc(u.uid).set({ uid: u.uid, email: u.email, displayName: "VE Old Unverified", role: "Student", status: "active", active: true }, { merge: true });
var v;
try {
  v = await auth.getUserByEmail("ve.verified@example.com");
} catch {
  v = await auth.createUser({ email: "ve.verified@example.com", password: "Test123456!", emailVerified: true, displayName: "VE Verified" });
}
await auth.updateUser(v.uid, { emailVerified: true });
await db.collection("users").doc(v.uid).set({ uid: v.uid, email: v.email, displayName: "VE Verified", role: "Student", status: "active", active: true }, { merge: true });
console.log("seeded");
