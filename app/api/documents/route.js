import { NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "../../../lib/firebase-admin";
import {
  MANAGER_ROLES,
  createDocument,
  deleteDocument,
  listDocumentsForUser,
  updateDocument,
} from "../../../lib/server/documents-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// One endpoint for the whole LMS Documents module. Every response is scoped
// server-side to the AUTHENTICATED user's real role + enrollment /
// assignment data — a Student can never widen what they see by changing an
// id in the request. Managers (Admin/Director) get full management; a
// Teacher/Facilitator may upload/manage only materials for a course/class
// they are assigned to; a Student is strictly read-only.
async function access(request) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return { denied: NextResponse.json({ message: "Sign in to continue." }, { status: 401 }) };
  const db = getAdminDb();
  const decoded = await getAdminAuth().verifyIdToken(token);
  const snapshot = await db.collection("users").doc(decoded.uid).get();
  const profile = snapshot.data() || {};
  if (!snapshot.exists || profile.active === false) {
    return { denied: NextResponse.json({ message: "Account access is required." }, { status: 403 }) };
  }
  return {
    db,
    uid: decoded.uid,
    profile,
    role: profile.role || "",
    name: profile.displayName || profile.email || decoded.uid,
    isManager: MANAGER_ROLES.has(profile.role),
    canUpload: MANAGER_ROLES.has(profile.role) || profile.role === "Teacher" || profile.role === "Facilitator",
  };
}

function failure(stage, error) {
  if (error?.statusCode) return NextResponse.json({ message: error.message }, { status: error.statusCode });
  console.error("[documents-api] failed", { stage, code: error?.code || "unknown", message: error?.message || "unknown" });
  return NextResponse.json({ message: "Unable to complete this request. Please try again." }, { status: 500 });
}

async function readPayload(request) {
  const type = request.headers.get("content-type") || "";
  if (type.includes("multipart/form-data")) {
    const form = await request.formData();
    let meta = {};
    try {
      meta = JSON.parse(form.get("meta") || "{}");
    } catch {
      meta = {};
    }
    const file = form.get("file");
    if (file && typeof file.arrayBuffer === "function") {
      return { meta, file, buffer: Buffer.from(await file.arrayBuffer()) };
    }
    return { meta, file: null, buffer: null };
  }
  const body = await request.json().catch(() => ({}));
  return { meta: body, file: null, buffer: null };
}

export async function GET(request) {
  try {
    const a = await access(request);
    if (a.denied) return a.denied;
    const result = await listDocumentsForUser(a.db, a.uid, a.profile);
    return NextResponse.json({ ...result, canManage: a.isManager, canUpload: a.canUpload });
  } catch (error) {
    return failure("list", error);
  }
}

export async function POST(request) {
  try {
    const a = await access(request);
    if (a.denied) return a.denied;
    if (!a.canUpload) return NextResponse.json({ message: "You do not have permission to upload documents." }, { status: 403 });
    const { meta, file, buffer } = await readPayload(request);
    const result = await createDocument(a.db, { meta, file, buffer }, { uid: a.uid, role: a.role, name: a.name, profile: a.profile });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return failure("create", error);
  }
}

export async function PATCH(request) {
  try {
    const a = await access(request);
    if (a.denied) return a.denied;
    if (!a.canUpload) return NextResponse.json({ message: "You do not have permission to manage documents." }, { status: 403 });
    const { meta, file, buffer } = await readPayload(request);
    const id = typeof meta.id === "string" ? meta.id : "";
    if (!id) return NextResponse.json({ message: "Document ID is required." }, { status: 400 });
    const result = await updateDocument(a.db, id, { meta, file, buffer }, { uid: a.uid, role: a.role, name: a.name, profile: a.profile });
    return NextResponse.json(result.body, { status: result.status });
  } catch (error) {
    return failure("update", error);
  }
}

export async function DELETE(request) {
  try {
    const a = await access(request);
    if (a.denied) return a.denied;
    if (!a.canUpload) return NextResponse.json({ message: "You do not have permission to delete documents." }, { status: 403 });
    const body = await request.json().catch(() => ({}));
    if (typeof body.id !== "string" || !body.id) return NextResponse.json({ message: "Document ID is required." }, { status: 400 });
    const result = await deleteDocument(a.db, body.id, { uid: a.uid, role: a.role });
    return NextResponse.json(result.body, { status: result.status });
  } catch (error) {
    return failure("delete", error);
  }
}
