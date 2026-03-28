"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { Conversation, Message } from "@/types";
import MessageBubble from "./MessageBubble";
import ReplyBox from "./ReplyBox";

interface Props {
  conversation: Conversation;
}

export default function MessageThread({ conversation }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const prevIdRef = useRef<string | null>(null);

  const fetchMessages = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        const res = await fetch(
          `/api/conversations/${conversation.id}/messages`
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as Message[];
        setMessages(data);
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load messages");
      } finally {
        setLoading(false);
      }
    },
    [conversation.id]
  );

  // Re-fetch when conversation changes
  useEffect(() => {
    if (prevIdRef.current !== conversation.id) {
      prevIdRef.current = conversation.id;
      setMessages([]);
      setLoading(true);
    }
    void fetchMessages();

    // Poll every 5 s for new messages
    const interval = setInterval(() => void fetchMessages(true), 5_000);
    return () => clearInterval(interval);
  }, [conversation.id, fetchMessages]);

  // Scroll to bottom when messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleMessageSent = (message: Message) => {
    setMessages((prev) => [...prev, message]);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="shrink-0 flex items-center gap-3 px-4 py-3 border-b border-gray-200 bg-white">
        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-white font-semibold text-sm shrink-0 overflow-hidden">
          {conversation.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={conversation.avatarUrl}
              alt={conversation.name}
              className="w-full h-full object-cover"
            />
          ) : (
            conversation.name.charAt(0).toUpperCase()
          )}
        </div>
        <div className="min-w-0">
          <p className="font-semibold text-gray-900 truncate text-sm">
            {conversation.name}
          </p>
          <p className="text-xs text-gray-400">{messages.length} messages</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 bg-gray-50">
        {loading && messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-400 text-sm">
            Loading messages…
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-full gap-2">
            <p className="text-red-500 text-sm">{error}</p>
            <button
              onClick={() => void fetchMessages()}
              className="text-sm text-blue-500 underline"
            >
              Retry
            </button>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-400 text-sm">
            No messages yet
          </div>
        ) : (
          messages.map((msg) => <MessageBubble key={msg.id} message={msg} />)
        )}
        <div ref={bottomRef} />
      </div>

      {/* Reply box */}
      <ReplyBox
        conversationId={conversation.id}
        messages={messages}
        onMessageSent={handleMessageSent}
      />
    </div>
  );
}
