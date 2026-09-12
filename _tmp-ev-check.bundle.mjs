// _tmp-ev-check.mjs
import { readFileSync } from "node:fs";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
var env = {};
for (const line of readFileSync("D:/New folder (2)/nextlms/next-academy/.env.local", "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].replace(/^"(.*)"$/, "$1");
}
var app = getApps().length ? getApps()[0] : initializeApp({ credential: cert({ projectId: env.NEXT_PUBLIC_FIREBASE_PROJECT_ID, clientEmail: env.FIREBASE_ADMIN_CLIENT_EMAIL, privateKey: env.FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g, "\n") }) });
var db = getFirestore(app);
var snap = await db.collection("academyEvents").get();
console.log(`${snap.size} total events in academyEvents:`);
for (const d of snap.docs) {
  const x = d.data();
  console.log(" -", d.id, JSON.stringify({ name: x.name, published: x.published, status: x.status, eventDate: x.eventDate, startTime: x.startTime, endTime: x.endTime, type: x.type, bannerUrl: x.bannerUrl ? "yes" : "", targetAudience: x.targetAudience }));
}
