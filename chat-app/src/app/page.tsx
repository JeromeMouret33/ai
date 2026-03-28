"use client";

import { useCallback, useRef, useState } from "react";
import ConversationList from "@/components/ConversationList";
import MessageThread from "@/components/MessageThread";
import type { Conversation } from "@/types";

export default function HomePage() {
  const [active, setActive] = useState<Conversation | null>(null);
  const index = useRef<Map<string, Conversation>>(new Map());

  const handleLoaded = useCallback((conversations: Conversation[]) => {
    conversations.forEach((c) => index.current.set(c.id, c));
    // Keep the active conversation's metadata in sync
    setActive((prev) => (prev ? (index.current.get(prev.id) ?? prev) : null));
  }, []);

  const handleSelect = useCallback((id: string) => {
    const conv = index.current.get(id) ?? { id, name: id, unreadCount: 0 };
    setActive(conv);
  }, []);

  return (
    <div className="flex h-full overflow-hidden">
      {/* Sidebar */}
      <aside className="w-72 shrink-0 flex flex-col border-r border-gray-200 bg-white overflow-hidden">
        <div className="shrink-0 px-4 py-4 border-b border-gray-100">
          <h1 className="text-lg font-bold text-gray-900">Chat Hub</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            All your conversations, one place
          </p>
        </div>

        <div className="flex-1 overflow-y-auto">
          <ConversationList
            activeId={active?.id ?? null}
            onSelect={handleSelect}
            onLoaded={handleLoaded}
          />
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-hidden">
        {active ? (
          <MessageThread conversation={active} />
        ) : (
          <EmptyState />
        )}
      </main>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-3 px-8 text-center">
      <span className="text-5xl">💬</span>
      <h2 className="text-xl font-semibold text-gray-700">
        Select a conversation
      </h2>
      <p className="text-sm text-gray-400 max-w-xs">
        Pick a conversation from the sidebar. Click{" "}
        <kbd className="px-1.5 py-0.5 rounded bg-gray-100 text-xs font-mono">
          💡 Suggest
        </kbd>{" "}
        to generate an AI reply draft.
      </p>
    </div>
  );
}
