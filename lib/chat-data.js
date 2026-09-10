"use client";

import {
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  increment,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { db } from "./firebase";
import { deleteChatMedia } from "./chat-media";

// Reused as-is, not duplicated — already role-agnostic despite living in
// teacher-data.js (it takes a bare conversationId, no teacher-specific
// logic). It sorts newest-first via that file's shared `ordered()` helper;
// callers wanting oldest-first for a message thread should reverse locally.
export { subscribeConversationMessages } from "./teacher-data";

function ordered(snapshot) {
  return snapshot.docs
    .map((item) => ({ id: item.id, ...item.data() }))
    .sort((a, b) =>
      String(b.updatedAt?.toMillis?.() || b.createdAt?.toMillis?.() || "").localeCompare(
        String(a.updatedAt?.toMillis?.() || a.createdAt?.toMillis?.() || ""),
      ),
    );
}

// Role-agnostic — reused by every dashboard shell (Admin/Director/Teacher/
// Student), not just Teacher. `lib/teacher-data.js` keeps its own
// Teacher-specific `subscribeTeacherConversations`/`sendTeacherMessage`
// untouched as a safety net; this is the generic replacement new call sites
// use going forward. Conversations the current user has hidden (see
// hideConversationForMe) are filtered out here — the one place every
// consumer (conversation list, unread badge) reads from.
export function subscribeMyConversations(uid, onData, onError) {
  if (!db || !uid) return () => {};
  return onSnapshot(
    query(collection(db, "conversations"), where("participantIds", "array-contains", uid)),
    (snapshot) => onData(ordered(snapshot).filter((item) => !(item.hiddenFor || []).includes(uid))),
    (error) => onError?.(error),
  );
}

function conversationId(uidA, uidB) {
  return [uidA, uidB].sort().join("_");
}

// Idempotent — safe to call every time a contact is clicked, even if the
// conversation already exists (a plain getDoc + merge:true, not a query).
// Direct 1:1 chat is open between any two signed-in users (see
// firestore.rules' conversations comment) — no relationship/assignment
// check is done here or enforced server-side anymore.
export async function createConversationIfMissing({ uidA, roleA, nameA, uidB, roleB, nameB }) {
  if (!db) throw new Error("Firebase is not configured.");
  const id = conversationId(uidA, uidB);
  const ref = doc(db, "conversations", id);
  const existing = await getDoc(ref);
  if (existing.exists()) return id;

  // teacherId/studentId are keyed off each participant's actual role, not
  // "is this a verified assigned pair" — Admin-initiated conversations with
  // a Volunteer/Facilitator legitimately have both set to null. Both keys
  // must always be present (never omitted) because the conversations
  // `update` rule later compares them against the existing doc, and
  // comparing against a missing key throws.
  const teacherId = roleA === "Teacher" ? uidA : roleB === "Teacher" ? uidB : null;
  const studentId = roleA === "Student" ? uidA : roleB === "Student" ? uidB : null;

  await writeBatch(db)
    .set(
      ref,
      {
        type: "direct",
        participantIds: [uidA, uidB],
        participantNames: { [uidA]: nameA || "", [uidB]: nameB || "" },
        participantRoles: { [uidA]: roleA, [uidB]: roleB },
        teacherId,
        studentId,
        lastMessage: "",
        lastMessageAt: null,
        unreadCount: { [uidA]: 0, [uidB]: 0 },
        hiddenFor: [],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    )
    .commit();
  return id;
}

// members: [{ uid, name, role }, ...] — NOT including the creator, who is
// always added as the first participant and initial (sole) group admin.
// Group creation is restricted to Admin/Director/Teacher, mirrored in
// firestore.rules' conversations `create` rule.
export async function createGroupConversation({ creatorUid, creatorName, creatorRole, name, description, members }) {
  if (!db) throw new Error("Firebase is not configured.");
  const groupName = (name || "").trim();
  if (!groupName) throw new Error("Group name is required.");
  const uniqueMembers = (members || []).filter((member, index, all) => all.findIndex((m) => m.uid === member.uid) === index && member.uid !== creatorUid);
  if (!uniqueMembers.length) throw new Error("Select at least one member.");

  const ref = doc(collection(db, "conversations"));
  const allMembers = [{ uid: creatorUid, name: creatorName, role: creatorRole }, ...uniqueMembers];
  const participantIds = allMembers.map((m) => m.uid);

  await setDoc(ref, {
    type: "group",
    participantIds,
    participantNames: Object.fromEntries(allMembers.map((m) => [m.uid, m.name || ""])),
    participantRoles: Object.fromEntries(allMembers.map((m) => [m.uid, m.role || ""])),
    groupName,
    groupPhoto: "",
    groupDescription: (description || "").trim(),
    groupAdminIds: [creatorUid],
    createdBy: creatorUid,
    teacherId: null,
    studentId: null,
    lastMessage: "",
    lastMessageAt: null,
    unreadCount: Object.fromEntries(participantIds.map((id) => [id, 0])),
    hiddenFor: [],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function renameGroup(convId, name) {
  if (!db) throw new Error("Firebase is not configured.");
  const trimmed = (name || "").trim();
  if (!trimmed) throw new Error("Group name is required.");
  await updateDoc(doc(db, "conversations", convId), { groupName: trimmed, updatedAt: serverTimestamp() });
}

export async function updateGroupDescription(convId, description) {
  if (!db) throw new Error("Firebase is not configured.");
  await updateDoc(doc(db, "conversations", convId), { groupDescription: (description || "").trim(), updatedAt: serverTimestamp() });
}

export async function updateGroupPhoto(convId, photoUrl) {
  if (!db) throw new Error("Firebase is not configured.");
  await updateDoc(doc(db, "conversations", convId), { groupPhoto: photoUrl, updatedAt: serverTimestamp() });
}

// newMembers: [{ uid, name, role }, ...]. Admin-only (enforced by rules).
export async function addGroupMembers(conversation, newMembers) {
  if (!db) throw new Error("Firebase is not configured.");
  const additions = (newMembers || []).filter((m) => !conversation.participantIds.includes(m.uid));
  if (!additions.length) return;
  const participantIds = [...conversation.participantIds, ...additions.map((m) => m.uid)];
  const participantNames = { ...conversation.participantNames };
  const participantRoles = { ...conversation.participantRoles };
  const unreadCount = { ...conversation.unreadCount };
  additions.forEach((m) => {
    participantNames[m.uid] = m.name || "";
    participantRoles[m.uid] = m.role || "";
    unreadCount[m.uid] = 0;
  });
  await updateDoc(doc(db, "conversations", conversation.id), { participantIds, participantNames, participantRoles, unreadCount, updatedAt: serverTimestamp() });
}

// Admin removes another member. Use leaveGroup() for a member removing
// themself — the two map to distinct firestore.rules branches.
export async function removeGroupMember(conversation, memberUid) {
  if (!db) throw new Error("Firebase is not configured.");
  const participantIds = conversation.participantIds.filter((id) => id !== memberUid);
  const groupAdminIds = (conversation.groupAdminIds || []).filter((id) => id !== memberUid);
  await updateDoc(doc(db, "conversations", conversation.id), { participantIds, groupAdminIds, updatedAt: serverTimestamp() });
}

// If the leaving member was the last remaining admin, the next remaining
// participant is promoted automatically so the group is never left with no
// admin able to manage it.
export async function leaveGroup(conversation, myUid) {
  if (!db) throw new Error("Firebase is not configured.");
  const participantIds = conversation.participantIds.filter((id) => id !== myUid);
  let groupAdminIds = (conversation.groupAdminIds || []).filter((id) => id !== myUid);
  if (!groupAdminIds.length && participantIds.length) groupAdminIds = [participantIds[0]];
  await updateDoc(doc(db, "conversations", conversation.id), { participantIds, groupAdminIds, updatedAt: serverTimestamp() });
}

// User-level hide, not a global delete — "Delete Conversation" removes the
// conversation from only the caller's own list (subscribeMyConversations
// filters on hiddenFor). Messages and the conversation doc itself are left
// completely intact for the other participant(s), matching "prefer
// user-level conversation deletion/hiding" over destroying shared history.
// A new incoming message automatically un-hides it for its recipient(s)
// (see sendMessage below), the same way most chat apps behave.
export async function hideConversationForMe(convId, uid) {
  if (!db) throw new Error("Firebase is not configured.");
  await updateDoc(doc(db, "conversations", convId), { hiddenFor: arrayUnion(uid) });
}

// A message's Storage path (chat/{conversationId}/{messageId}/{fileName})
// needs the message's id BEFORE the upload starts. This hands out that id
// up front — sendMessage() below then writes the Firestore doc at that
// exact same id afterward, instead of letting Firestore mint a new one.
export function newMessageId(convId) {
  return doc(collection(db, "conversations", convId, "messages")).id;
}

// Denormalized preview text for a conversation's lastMessage / a
// notification body — media messages without a caption get a readable
// placeholder instead of an empty string.
function previewText(body, type) {
  const trimmed = (body || "").trim();
  if (trimmed) return trimmed;
  if (type === "image") return "📷 Photo";
  if (type === "audio") return "🎤 Voice message";
  if (type === "video") return "🎥 Video";
  if (type === "file") return "📎 File";
  return "";
}

// One batch — message create + conversation update (lastMessage/unreadCount)
// + notification create(s) — instead of several sequential awaits, so a
// failure partway through can never leave the conversation preview or
// unread badge out of sync with the actual messages subcollection.
//
// For a DIRECT conversation, pass `receiverId` exactly as before (fully
// backward-compatible — every existing 4-arg call site still works
// unmodified). For a GROUP conversation, pass `receiverId` as null/undefined
// and set `extra.recipientIds` to every other participant instead — the
// message is written with no `receiverId` field at all (required by
// firestore.rules' group branch), and unread/notifications fan out to each
// recipient. `extra.groupName` labels the notification when sending to a
// group.
//
// `extra` (all optional):
//   type: "text"|"image"|"audio"|"video"|"file" (default "text")
//   fileUrl, fileName, mimeType, fileSize, duration, storagePath — media only
//   replyTo: the original message object being replied to (denormalized
//     into replyTo* fields, no extra read since the caller already has it)
//   messageId: reuse a pre-generated id (see newMessageId) instead of a
//     fresh auto-id — required for media so the Storage path and the
//     Firestore doc agree on the same id.
//   recipientIds, groupName: group sends only (see above).
export async function sendMessage(convId, senderId, receiverId, body, extra = {}) {
  if (!db) throw new Error("Firebase is not configured.");
  const { type = "text", fileUrl, fileName, mimeType, fileSize, duration, storagePath, replyTo, messageId, recipientIds, groupName } = extra;
  const trimmed = (body || "").trim();
  if (type === "text" && !trimmed) throw new Error("Message cannot be empty.");

  const batch = writeBatch(db);
  const messageRef = messageId
    ? doc(db, "conversations", convId, "messages", messageId)
    : doc(collection(db, "conversations", convId, "messages"));
  const preview = previewText(trimmed, type);

  const messageData = {
    senderId,
    body: trimmed,
    type,
    createdAt: serverTimestamp(),
    readAt: null,
  };
  if (receiverId) messageData.receiverId = receiverId;
  if (fileUrl) messageData.fileUrl = fileUrl;
  if (fileName) messageData.fileName = fileName;
  if (mimeType) messageData.mimeType = mimeType;
  if (typeof fileSize === "number") messageData.fileSize = fileSize;
  if (typeof duration === "number") messageData.duration = duration;
  if (storagePath) messageData.storagePath = storagePath;
  if (replyTo) {
    messageData.replyToMessageId = replyTo.id;
    messageData.replyToText = previewText(replyTo.body, replyTo.type);
    messageData.replyToSenderId = replyTo.senderId;
    messageData.replyToMessageType = replyTo.type || "text";
  }

  const recipients = receiverId ? [receiverId] : recipientIds || [];
  const conversationUpdate = {
    lastMessage: preview,
    lastMessageAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  recipients.forEach((id) => {
    conversationUpdate[`unreadCount.${id}`] = increment(1);
  });
  if (recipients.length) conversationUpdate.hiddenFor = arrayRemove(...recipients);

  batch.set(messageRef, messageData);
  batch.update(doc(db, "conversations", convId), conversationUpdate);
  recipients.forEach((id) => {
    batch.set(doc(collection(db, "notifications")), {
      userId: id,
      type: "message",
      title: groupName ? `New message in ${groupName}` : "New message",
      body: preview,
      entityId: messageRef.id,
      actionUrl: null,
      readAt: null,
      createdAt: serverTimestamp(),
    });
  });
  await batch.commit();
  return messageRef.id;
}

// Sender-only, mirrors the existing Firestore rule exactly. Removes the
// Storage object first (non-fatal on failure, same pattern as
// lib/teacher-documents.js's deleteTeacherDocument) then the message doc.
export async function deleteMessage(convId, messageId, storagePath) {
  if (!db) throw new Error("Firebase is not configured.");
  if (storagePath) await deleteChatMedia(storagePath);
  await deleteDoc(doc(db, "conversations", convId, "messages", messageId));
}

// Marks every unread message addressed to `myUid` in this DIRECT
// conversation as read, and decrements (never hard-resets) the unread
// counter by the exact number transitioned — so a message arriving in the
// same instant can never be silently clobbered by an unconditional reset to
// 0. Use markGroupConversationRead for a group (see below) — a group
// message has no single receiver to flip readAt on.
export async function markConversationRead(convId, myUid) {
  if (!db || !convId || !myUid) return;
  const snapshot = await getDocs(
    query(
      collection(db, "conversations", convId, "messages"),
      where("receiverId", "==", myUid),
      where("readAt", "==", null),
    ),
  );
  if (snapshot.empty) return;

  const batch = writeBatch(db);
  snapshot.docs.forEach((docSnap) => batch.update(docSnap.ref, { readAt: serverTimestamp() }));
  batch.update(doc(db, "conversations", convId), {
    [`unreadCount.${myUid}`]: increment(-snapshot.size),
  });
  await batch.commit();
}

// Groups track unread purely as a per-member counter on the conversation
// doc — there's no per-message readAt for a group message (see
// firestore.rules), since a group message can have many readers, not one.
export async function markGroupConversationRead(convId, myUid) {
  if (!db || !convId || !myUid) return;
  await updateDoc(doc(db, "conversations", convId), { [`unreadCount.${myUid}`]: 0 });
}
