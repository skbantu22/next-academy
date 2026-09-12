import { readFileSync } from "node:fs";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
const env = {};
for (const line of readFileSync("D:/New folder (2)/nextlms/next-academy/.env.local", "utf8").split(/\r?\n/)) { const m = line.match(/^([A-Z0-9_]+)=(.*)$/); if (m) env[m[1]] = m[2].replace(/^"(.*)"$/, "$1"); }
const app = getApps().length ? getApps()[0] : initializeApp({ credential: cert({ projectId: env.NEXT_PUBLIC_FIREBASE_PROJECT_ID, clientEmail: env.FIREBASE_ADMIN_CLIENT_EMAIL, privateKey: env.FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g, "\n") }) });
const db = getFirestore(app);
const auth = getAuth(app);
let u;
try { u = await auth.getUserByEmail("del.test@example.com"); } catch { u = await auth.createUser({ email: "del.test@example.com", password: "Test123456!", emailVerified: true, displayName: "Delete Test User" }); }
await auth.updateUser(u.uid, { emailVerified: true });
await db.collection("users").doc(u.uid).set({ email: "del.test@example.com", displayName: "Delete Test User", role: "Student", active: true, status: "active" }, { merge: true });
console.log(JSON.stringify({ uid: u.uid }));
process.exit(0);
