"use client";

import { useEffect, useState, useCallback } from "react";
import clsx from "clsx";
import type { Conversation } from "@/types";

interface Props {
  activeId: string | null;
  onSelect: (id: string) => void;
}

function formatTime(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60_000);
  if (diffMins < 1) return "now";
  if (diffMins < 60) return `${diffMins}m`;
  const diffH = Math.floor(diffMins / 60);
  if (diffH < 24) return `${diffH}h`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function ConversationList({ activeId, onSelect }: Props) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchConversations = useCallback(async () => {
    try {
      const res = await fetch("/api/conversations");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as Conversation[];
      setConversations(data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load conversations");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchConversations();
    // Poll every 15 s to refresh unread counts / last messages
    const interval = setInterval(() => void fetchConversations(), 15_000);
    return () => clearInterval(interval);
  }, [fetchConversations]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400 text-sm">
        Loading…
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4">
        <p className="text-red-500 text-sm mb-2">Error: {error}</p>
        <button
          onClick={() => void fetchConversations()}
          className="text-sm text-blue-500 underline"
        >
          Retry
        </button>
      </div>
    );
  }

  if (conversations.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400 text-sm">
        No conversations
      </div>
    );
  }

  return (
    <ul className="divide-y divide-gray-100">
      {conversations.map((conv) => (
        <li key={conv.id}>
          <button
            onClick={() => onSelect(conv.id)}
            className={clsx(
              "w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-gray-50 transition-colors",
              activeId === conv.id && "bg-blue-50 border-r-2 border-blue-500"
            )}
          >
            {/* Avatar */}
            <div className="shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-white font-semibold text-sm overflow-hidden">
              {conv.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={conv.avatarUrl}
                  alt={conv.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                conv.name.charAt(0).toUpperCase()
              )}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-1">
                <span
                  className={clsx(
                    "truncate text-sm",
                    conv.unreadCount > 0
                      ? "font-semibold text-gray-900"
                      : "font-medium text-gray-700"
                  )}
                >
                  {conv.name}
                </span>
                <span className="shrink-0 text-xs text-gray-400">
                  {formatTime(conv.lastMessageAt)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-1 mt-0.5">
                <p className="truncate text-xs text-gray-500">
                  {conv.lastMessage ?? "—"}
                </p>
                {conv.unreadCount > 0 && (
                  <span className="shrink-0 inline-flex items-center justify-center min-w-[1.25rem] h-5 rounded-full bg-blue-500 text-white text-xs font-bold px-1">
                    {conv.unreadCount > 99 ? "99+" : conv.unreadCount}
                  </span>
                )}
              </div>
            </div>
          </button>
        </li>
      ))}
    </ul>
  );
}
