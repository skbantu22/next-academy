"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { MessageCircle } from "lucide-react";
import { useAuth } from "../../lib/auth-context";
import { subscribeMyConversations } from "../../lib/chat-data";

// Renders as a real link when given `href` (Teacher, whose Chat module is a
// real route), otherwise a button calling `onClick` (Admin/Director/others,
// whose Chat module is client-side tab state) — same component either way.
export default function ChatButton({ href, onClick }) {
  const { user } = useAuth();
  const [conversations, setConversations] = useState([]);

  useEffect(() => {
    if (!user?.uid) return undefined;
    return subscribeMyConversations(user.uid, setConversations, () => {});
  }, [user?.uid]);

  const unreadCount = useMemo(
    () => conversations.reduce((sum, item) => sum + Number(item.unreadCount?.[user?.uid] || 0), 0),
    [conversations, user?.uid],
  );

  const badge = unreadCount > 0 && (
    <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[9px] font-bold text-white">
      {unreadCount > 9 ? "9+" : unreadCount}
    </span>
  );

  const className = "relative rounded-xl p-2.5 text-muted transition hover:bg-page hover:text-primary";

  if (href) {
    return (
      <Link href={href} className={className} aria-label="Open chat">
        <MessageCircle className="h-5 w-5" aria-hidden="true" />
        {badge}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} className={className} aria-label="Open chat">
      <MessageCircle className="h-5 w-5" aria-hidden="true" />
      {badge}
    </button>
  );
}

// Shared by AdminShell's sidebar row (real badge instead of the old
// hardcoded "3") and anywhere else a plain unread count number is needed
// without the icon button chrome.
export function useUnreadConversationCount() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState([]);
  useEffect(() => {
    if (!user?.uid) return undefined;
    return subscribeMyConversations(user.uid, setConversations, () => {});
  }, [user?.uid]);
  return useMemo(
    () => conversations.reduce((sum, item) => sum + Number(item.unreadCount?.[user?.uid] || 0), 0),
    [conversations, user?.uid],
  );
}
