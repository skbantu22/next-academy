"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { Check, CheckCheck, MessageCircle, Search, Send, UserPlus } from "lucide-react";
import { db } from "../../lib/firebase";
import { useAuth } from "../../lib/auth-context";
import { subscribeTeacherStudents } from "../../lib/teacher-data";
import {
  createConversationIfMissing,
  markConversationRead,
  sendMessage,
  subscribeConversationMessages,
  subscribeMyConversations,
} from "../../lib/chat-data";
import { studentApi } from "../../lib/services/student-service";
import { loadTeacherAssignmentData } from "../../lib/services/teacher-assignment-service";

function initials(name) {
  return (name || "?").trim().slice(0, 2).toUpperCase();
}

function timeAgo(timestamp) {
  const date = timestamp?.toDate?.();
  if (!date) return "";
  const seconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
  if (seconds < 60) return "now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return date.toLocaleDateString();
}

function messageTime(timestamp) {
  const date = timestamp?.toDate?.();
  if (!date) return "";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

// "Start new conversation" contact source branches by role — reuses
// whatever directory already exists for that role instead of inventing a
// new endpoint. Volunteer/Facilitator have no assigned-relationship data to
// source a directory from, so they get an empty list (honest limitation,
// not invented data) but can still see/reply to conversations others start.
function useContactDirectory(currentUserId, currentUserRole) {
  const { profile } = useAuth();
  const [contacts, setContacts] = useState([]);

  useEffect(() => {
    let cancelled = false;

    if (currentUserRole === "Teacher") {
      return subscribeTeacherStudents(
        currentUserId,
        (students) => {
          if (!cancelled) {
            setContacts(students.map((s) => ({ uid: s.id, name: s.displayName || s.email || "Student", role: "Student" })));
          }
        },
        () => {},
      );
    }

    if (currentUserRole === "Student") {
      const teacherIds = profile?.teacherIds || [];
      if (!db || !teacherIds.length) {
        void Promise.resolve().then(() => {
          if (!cancelled) setContacts([]);
        });
        return undefined;
      }
      Promise.all(teacherIds.map((id) => getDoc(doc(db, "users", id))))
        .then((snapshots) => {
          if (cancelled) return;
          setContacts(
            snapshots
              .filter((snap) => snap.exists())
              .map((snap) => ({ uid: snap.id, name: snap.data().displayName || snap.data().email || "Teacher", role: "Teacher" })),
          );
        })
        .catch(() => {
          if (!cancelled) setContacts([]);
        });
      return () => {
        cancelled = true;
      };
    }

    if (currentUserRole === "Admin" || currentUserRole === "Director") {
      Promise.all([studentApi(), loadTeacherAssignmentData()])
        .then(([studentsRes, teacherRes]) => {
          if (cancelled) return;
          const students = (studentsRes.students || []).map((s) => ({
            uid: s.id,
            name: s.displayName || s.email || "Student",
            role: "Student",
          }));
          const teachers = (teacherRes.teachers || []).map((t) => ({
            uid: t.id,
            name: t.displayName || t.email || "Teacher",
            role: "Teacher",
          }));
          setContacts([...teachers, ...students]);
        })
        .catch(() => {
          if (!cancelled) setContacts([]);
        });
      return () => {
        cancelled = true;
      };
    }

    void Promise.resolve().then(() => {
      if (!cancelled) setContacts([]);
    });
    return () => {
      cancelled = true;
    };
  }, [currentUserId, currentUserRole, profile?.teacherIds]);

  return contacts;
}

export default function ChatWorkspace({ currentUserId, currentUserRole, currentUserName }) {
  const [conversations, setConversations] = useState([]);
  const [selected, setSelected] = useState("");
  const [messages, setMessages] = useState([]);
  const [search, setSearch] = useState("");
  const [mode, setMode] = useState("conversations"); // "conversations" | "contacts"
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const bottomRef = useRef(null);

  const contacts = useContactDirectory(currentUserId, currentUserRole);

  useEffect(() => {
    if (!currentUserId) return undefined;
    return subscribeMyConversations(currentUserId, setConversations, () => {});
  }, [currentUserId]);

  useEffect(() => {
    if (!selected) {
      void Promise.resolve().then(() => setMessages([]));
      return undefined;
    }
    return subscribeConversationMessages(selected, (rows) => setMessages([...rows].reverse()), () => {});
  }, [selected]);

  useEffect(() => {
    if (!selected || !currentUserId) return;
    const hasUnreadForMe = messages.some((m) => m.receiverId === currentUserId && !m.readAt);
    if (hasUnreadForMe) markConversationRead(selected, currentUserId);
  }, [selected, messages, currentUserId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, selected]);

  const conversation = conversations.find((item) => item.id === selected);
  const otherUid = conversation?.participantIds?.find((id) => id !== currentUserId);
  const otherName = otherUid ? conversation.participantNames?.[otherUid] || "Conversation" : "";

  const filteredConversations = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return conversations;
    return conversations.filter((item) => {
      const other = item.participantIds?.find((id) => id !== currentUserId);
      const name = other ? item.participantNames?.[other] || "" : "";
      return name.toLowerCase().includes(term) || (item.lastMessage || "").toLowerCase().includes(term);
    });
  }, [conversations, search, currentUserId]);

  const filteredContacts = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return contacts;
    return contacts.filter((c) => c.name.toLowerCase().includes(term));
  }, [contacts, search]);

  async function openContact(contact) {
    setError("");
    try {
      const id = await createConversationIfMissing({
        uidA: currentUserId,
        roleA: currentUserRole,
        nameA: currentUserName,
        uidB: contact.uid,
        roleB: contact.role,
        nameB: contact.name,
      });
      setSelected(id);
      setMode("conversations");
      setSearch("");
    } catch (err) {
      setError(err.message || "Unable to start this conversation.");
    }
  }

  async function handleSend() {
    const trimmed = draft.trim();
    if (!trimmed || !conversation || !otherUid || sending) return;
    setSending(true);
    setError("");
    try {
      await sendMessage(selected, currentUserId, otherUid, trimmed);
      setDraft("");
    } catch (err) {
      setError(err.message || "Unable to send this message.");
    } finally {
      setSending(false);
    }
  }

  function handleKeyDown(event) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  }

  return (
    <div className="grid gap-4 overflow-hidden rounded-3xl border border-border-subtle bg-white shadow-sm lg:h-[calc(100vh-160px)] lg:grid-cols-[320px_1fr]">
      <div className="flex flex-col border-b border-border-subtle lg:border-b-0 lg:border-r">
        <div className="flex items-center justify-between gap-2 border-b border-border-subtle p-4">
          <b className="text-sm text-ink">Messages</b>
          <button
            type="button"
            onClick={() => {
              setMode((m) => (m === "contacts" ? "conversations" : "contacts"));
              setSearch("");
            }}
            className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider transition ${mode === "contacts" ? "bg-primary text-white" : "bg-page text-muted hover:bg-active hover:text-primary"}`}
          >
            <UserPlus className="h-3.5 w-3.5" aria-hidden="true" />
            New
          </button>
        </div>
        <div className="relative border-b border-border-subtle p-3">
          <Search className="pointer-events-none absolute left-6 top-6 h-4 w-4 text-subtle" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={mode === "contacts" ? "Search people..." : "Search messages..."}
            className="w-full rounded-xl border border-border-subtle bg-page py-2 pl-9 pr-3 text-xs outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <div className="flex-1 overflow-y-auto">
          {mode === "contacts" ? (
            filteredContacts.length ? (
              filteredContacts.map((contact) => (
                <button
                  key={contact.uid}
                  type="button"
                  onClick={() => openContact(contact)}
                  className="flex w-full items-center gap-3 border-b border-border-subtle px-4 py-3 text-left transition hover:bg-page"
                >
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary text-xs font-bold text-white">
                    {initials(contact.name)}
                  </span>
                  <span className="min-w-0">
                    <b className="block truncate text-xs text-ink">{contact.name}</b>
                    <span className="text-[10px] text-subtle">{contact.role}</span>
                  </span>
                </button>
              ))
            ) : (
              <p className="px-4 py-8 text-center text-xs text-muted">
                {currentUserRole === "Volunteer" || currentUserRole === "Facilitator"
                  ? "No directory is available for this role yet."
                  : "No contacts found."}
              </p>
            )
          ) : filteredConversations.length ? (
            filteredConversations.map((item) => {
              const other = item.participantIds?.find((id) => id !== currentUserId);
              const name = other ? item.participantNames?.[other] || "Conversation" : "Conversation";
              const unread = Number(item.unreadCount?.[currentUserId] || 0);
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelected(item.id)}
                  className={`flex w-full items-center gap-3 border-b border-border-subtle px-4 py-3 text-left transition hover:bg-page ${selected === item.id ? "bg-active" : ""}`}
                >
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary text-xs font-bold text-white">
                    {initials(name)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <b className="truncate text-xs text-ink">{name}</b>
                      <span className="shrink-0 text-[10px] text-subtle">{timeAgo(item.lastMessageAt)}</span>
                    </span>
                    <span className="mt-0.5 flex items-center justify-between gap-2">
                      <span className="truncate text-xs text-muted">{item.lastMessage || "No messages yet"}</span>
                      {unread > 0 && (
                        <span className="grid h-4 min-w-4 shrink-0 place-items-center rounded-full bg-primary px-1 text-[9px] font-bold text-white">
                          {unread > 9 ? "9+" : unread}
                        </span>
                      )}
                    </span>
                  </span>
                </button>
              );
            })
          ) : (
            <p className="px-4 py-8 text-center text-xs text-muted">No conversations yet. Tap &ldquo;New&rdquo; to start one.</p>
          )}
        </div>
      </div>

      <div className="flex min-h-[420px] flex-col">
        {conversation ? (
          <>
            <div className="flex items-center gap-3 border-b border-border-subtle p-4">
              <span className="grid h-10 w-10 place-items-center rounded-full bg-primary text-sm font-bold text-white">
                {initials(otherName)}
              </span>
              <div>
                <b className="block text-sm text-ink">{otherName}</b>
                <span className="text-[10px] text-subtle">{conversation.participantRoles?.[otherUid] || ""}</span>
              </div>
            </div>
            <div className="flex-1 space-y-3 overflow-y-auto p-4">
              {messages.length ? (
                messages.map((item) => {
                  const mine = item.senderId === currentUserId;
                  return (
                    <div key={item.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                      <div
                        className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-xs ${mine ? "bg-primary text-white" : "border border-border-subtle bg-page text-ink"}`}
                      >
                        <p className="whitespace-pre-wrap break-words">{item.body}</p>
                        <span className={`mt-1 flex items-center justify-end gap-1 text-[9px] ${mine ? "text-white/70" : "text-subtle"}`}>
                          {messageTime(item.createdAt)}
                          {mine && (item.readAt ? <CheckCheck className="h-3 w-3" /> : <Check className="h-3 w-3" />)}
                        </span>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="grid h-full place-items-center text-xs text-muted">No messages yet — say hello.</div>
              )}
              <div ref={bottomRef} />
            </div>
            {error && <p className="border-t border-border-subtle px-4 py-2 text-[10px] font-semibold text-primary">{error}</p>}
            <div className="flex items-center gap-2 border-t border-border-subtle p-3">
              <input
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type a message..."
                className="flex-1 rounded-xl border border-border-subtle bg-page px-4 py-2.5 text-xs outline-none focus:ring-2 focus:ring-primary"
              />
              <button
                type="button"
                onClick={handleSend}
                disabled={!draft.trim() || sending}
                className="flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-xs font-bold text-white transition hover:bg-primary-hover disabled:opacity-50"
              >
                <Send className="h-3.5 w-3.5" aria-hidden="true" />
                {sending ? "Sending..." : "Send"}
              </button>
            </div>
          </>
        ) : (
          <div className="grid flex-1 place-items-center p-8 text-center">
            <div>
              <MessageCircle className="mx-auto h-10 w-10 text-subtle" aria-hidden="true" />
              <p className="mt-3 text-sm text-muted">Select a conversation to start messaging.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
