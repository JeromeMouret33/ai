"use client";

import { useState } from "react";
import ConversationList from "@/components/ConversationList";
import MessageThread from "@/components/MessageThread";
import type { Conversation } from "@/types";

export default function HomePage() {
  const [activeConversation, setActiveConversation] =
    useState<Conversation | null>(null);

  // We keep a local registry so MessageThread can receive the full object
  // without an extra fetch.
  const [conversationMap, setConversationMap] = useState<
    Map<string, Conversation>
  >(new Map());

  const handleSelect = (id: string) => {
    const conv = conversationMap.get(id);
    if (conv) {
      setActiveConversation(conv);
    } else {
      // Fallback: create a minimal placeholder until the list refreshes
      const placeholder: Conversation = {
        id,
        name: `Conversation ${id}`,
        unreadCount: 0,
      };
      setActiveConversation(placeholder);
    }
  };

  // ConversationList calls this when it receives fresh data so we can
  // keep conversationMap in sync.
  const handleConversationsLoaded = (conversations: Conversation[]) => {
    setConversationMap(
      new Map(conversations.map((c) => [c.id, c]))
    );
    // Update the active conversation if it changed
    if (activeConversation) {
      const updated = conversations.find((c) => c.id === activeConversation.id);
      if (updated) setActiveConversation(updated);
    }
  };

  return (
    <div className="flex h-full overflow-hidden">
      {/* ── Left sidebar ─────────────────────────────────────────────────── */}
      <aside className="w-72 shrink-0 flex flex-col border-r border-gray-200 bg-white overflow-hidden">
        {/* Sidebar header */}
        <div className="shrink-0 px-4 py-4 border-b border-gray-100">
          <h1 className="text-lg font-bold text-gray-900">Chat Hub</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            All your conversations, one place
          </p>
        </div>

        {/* Conversation list with scrolling */}
        <div className="flex-1 overflow-y-auto">
          <ConversationListWrapper
            activeId={activeConversation?.id ?? null}
            onSelect={handleSelect}
            onLoaded={handleConversationsLoaded}
          />
        </div>
      </aside>

      {/* ── Main area ────────────────────────────────────────────────────── */}
      <main className="flex-1 overflow-hidden">
        {activeConversation ? (
          <MessageThread conversation={activeConversation} />
        ) : (
          <EmptyState />
        )}
      </main>
    </div>
  );
}

// ─── Thin wrapper so ConversationList can report loaded data upward ──────────

interface WrapperProps {
  activeId: string | null;
  onSelect: (id: string) => void;
  onLoaded: (conversations: Conversation[]) => void;
}

function ConversationListWrapper({
  activeId,
  onSelect,
  onLoaded,
}: WrapperProps) {
  // We intercept the data inside ConversationList via a wrapping component
  // that uses a patched fetch.  A simpler approach: lift the fetch here and
  // pass conversations down as props.  That is what we do below.
  return (
    <ConversationListFetcher
      activeId={activeId}
      onSelect={onSelect}
      onLoaded={onLoaded}
    />
  );
}

import { useEffect, useCallback } from "react";
import clsx from "clsx";

function ConversationListFetcher({
  activeId,
  onSelect,
  onLoaded,
}: WrapperProps) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchConversations = useCallback(async () => {
    try {
      const res = await fetch("/api/conversations");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as Conversation[];
      setConversations(data);
      onLoaded(data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [onLoaded]);

  useEffect(() => {
    void fetchConversations();
    const interval = setInterval(() => void fetchConversations(), 15_000);
    return () => clearInterval(interval);
  }, [fetchConversations]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-24 text-gray-400 text-sm">
        Loading…
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4">
        <p className="text-red-500 text-sm mb-2">{error}</p>
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
      <div className="flex items-center justify-center h-24 text-gray-400 text-sm">
        No conversations
      </div>
    );
  }

  return (
    <ul className="divide-y divide-gray-100">
      {conversations.map((conv) => (
        <ConversationRow
          key={conv.id}
          conversation={conv}
          active={activeId === conv.id}
          onClick={() => onSelect(conv.id)}
        />
      ))}
    </ul>
  );
}

// ─── Single row ───────────────────────────────────────────────────────────────

function ConversationRow({
  conversation,
  active,
  onClick,
}: {
  conversation: Conversation;
  active: boolean;
  onClick: () => void;
}) {
  const { name, lastMessage, lastMessageAt, unreadCount, avatarUrl } =
    conversation;

  return (
    <li>
      <button
        onClick={onClick}
        className={clsx(
          "w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-gray-50 transition-colors",
          active && "bg-blue-50 border-r-2 border-blue-500"
        )}
      >
        {/* Avatar */}
        <div className="shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-white font-semibold text-sm overflow-hidden">
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatarUrl}
              alt={name}
              className="w-full h-full object-cover"
            />
          ) : (
            name.charAt(0).toUpperCase()
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-1">
            <span
              className={clsx(
                "truncate text-sm",
                unreadCount > 0
                  ? "font-semibold text-gray-900"
                  : "font-medium text-gray-700"
              )}
            >
              {name}
            </span>
            <span className="shrink-0 text-xs text-gray-400">
              {formatTime(lastMessageAt)}
            </span>
          </div>
          <div className="flex items-center justify-between gap-1 mt-0.5">
            <p className="truncate text-xs text-gray-500">
              {lastMessage ?? "—"}
            </p>
            {unreadCount > 0 && (
              <span className="shrink-0 inline-flex items-center justify-center min-w-[1.25rem] h-5 rounded-full bg-blue-500 text-white text-xs font-bold px-1">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </div>
        </div>
      </button>
    </li>
  );
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

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center gap-3 px-8">
      <div className="text-5xl">💬</div>
      <h2 className="text-xl font-semibold text-gray-700">
        Select a conversation
      </h2>
      <p className="text-sm text-gray-400 max-w-xs">
        Choose a conversation from the left panel to read messages and reply.
        Press <kbd className="px-1 py-0.5 rounded bg-gray-100 text-xs font-mono">💡</kbd> to get an AI-powered reply suggestion.
      </p>
    </div>
  );
}
