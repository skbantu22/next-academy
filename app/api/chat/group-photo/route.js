import { NextResponse } from "next/server";
import { getAdminAuth, getAdminDb, getAdminStorage } from "../../../../lib/firebase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const maxSize = 5 * 1024 * 1024;

// Server-side upload (Admin SDK) — see storage.rules' chat-groups/photo
// comment for why: a group's conversationId isn't derivable from its
// members the way a direct conversation's is, so Storage Rules can't
// authorize this by path alone, and a Firestore membership check from
// Storage Rules hits the documented broken cross-service lookup. This route
// re-verifies group-admin status with a same-service Firestore read first.
export async function POST(request) {
  try {
    const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    if (!token) return NextResponse.json({ message: "Sign in to continue." }, { status: 401 });
    const db = getAdminDb();
    const decoded = await getAdminAuth().verifyIdToken(token);

    const form = await request.formData();
    const conversationId = form.get("conversationId");
    const file = form.get("file");
    if (typeof conversationId !== "string" || !conversationId) return NextResponse.json({ message: "Conversation ID is required." }, { status: 400 });
    if (!(file instanceof File)) return NextResponse.json({ message: "Choose a photo to upload." }, { status: 400 });
    if (!allowedTypes.has(file.type)) return NextResponse.json({ message: "Upload a JPEG, PNG, WEBP, or GIF image." }, { status: 400 });
    if (file.size > maxSize) return NextResponse.json({ message: "Group photos must be under 5 MB." }, { status: 400 });

    const conversationSnapshot = await db.collection("conversations").doc(conversationId).get();
    if (!conversationSnapshot.exists) return NextResponse.json({ message: "Group not found." }, { status: 404 });
    const conversation = conversationSnapshot.data();
    if (conversation.type !== "group" || !(conversation.groupAdminIds || []).includes(decoded.uid)) {
      return NextResponse.json({ message: "Only a group admin can change the group photo." }, { status: 403 });
    }

    const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_").slice(-120) || "photo";
    const path = `chat-groups/${conversationId}/photo/${Date.now()}_${safeName}`;
    const buffer = Buffer.from(await file.arrayBuffer());
    const bucket = getAdminStorage().bucket();
    const storageFile = bucket.file(path);
    await storageFile.save(buffer, { metadata: { contentType: file.type } });
    await storageFile.makePublic();
    const photoUrl = `https://storage.googleapis.com/${bucket.name}/${path}`;
    return NextResponse.json({ photoUrl });
  } catch (error) {
    console.error("[chat-group-photo-api] upload failed", { message: error?.message || "unknown" });
    return NextResponse.json({ message: "Unable to upload the group photo. Please try again." }, { status: 500 });
  }
}
