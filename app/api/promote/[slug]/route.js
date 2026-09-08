import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "../../../../lib/firebase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function loadLink(db, slug) {
  const linkSnapshot = await db.collection("promotionLinks").doc(slug).get();
  if (!linkSnapshot.exists || linkSnapshot.data().active === false) return null;
  return { id: linkSnapshot.id, ...linkSnapshot.data() };
}

export async function GET(_request, context) {
  try {
    const { slug } = await context.params;
    const db = getAdminDb();
    const link = await loadLink(db, slug);
    if (!link) return NextResponse.json({ message: "This promotion link is not available." }, { status: 404 });

    const [courseSnapshot, teacherSnapshot] = await Promise.all([
      db.collection("courses").doc(link.courseId).get(),
      db.collection("users").doc(link.teacherId).get(),
    ]);
    const course = courseSnapshot.data() || {};
    const teacher = teacherSnapshot.data() || {};

    await db.collection("promotionLinks").doc(slug).update({
      viewCount: FieldValue.increment(1),
    });

    return NextResponse.json({
      slug,
      courseTitle: course.title || "Training program",
      courseDescription: course.description || "",
      teacherName: teacher.displayName || "Next Academy",
    });
  } catch (error) {
    console.error("[promote-api] GET failed", { message: error?.message });
    return NextResponse.json({ message: "Unable to load this promotion link." }, { status: 500 });
  }
}

export async function POST(request, context) {
  try {
    const { slug } = await context.params;
    const db = getAdminDb();
    const link = await loadLink(db, slug);
    if (!link) return NextResponse.json({ message: "This promotion link is not available." }, { status: 404 });

    const body = await request.json().catch(() => ({}));

    if (body.event === "click") {
      await db.collection("promotionLinks").doc(slug).update({
        clickCount: FieldValue.increment(1),
      });
      return NextResponse.json({ ok: true });
    }

    const name = typeof body.name === "string" ? body.name.trim() : "";
    const email = typeof body.email === "string" ? body.email.trim() : "";
    const phone = typeof body.phone === "string" ? body.phone.trim() : "";
    const message = typeof body.message === "string" ? body.message.trim().slice(0, 1000) : "";
    if (!name || name.length > 160) return NextResponse.json({ message: "Enter your name." }, { status: 400 });
    if (!emailPattern.test(email)) return NextResponse.json({ message: "Enter a valid email address." }, { status: 400 });

    await db.collection("promotionLeads").add({
      linkId: slug,
      courseId: link.courseId,
      teacherId: link.teacherId,
      name,
      email,
      phone,
      message,
      status: "new",
      createdAt: FieldValue.serverTimestamp(),
    });
    await db.collection("promotionLinks").doc(slug).update({
      registrationCount: FieldValue.increment(1),
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[promote-api] POST failed", { message: error?.message });
    return NextResponse.json({ message: "Unable to submit your registration." }, { status: 500 });
  }
}
