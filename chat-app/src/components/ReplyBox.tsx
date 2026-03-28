"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import clsx from "clsx";
import type { Message } from "@/types";

interface Props {
  conversationId: string;
  messages: Message[];
  onMessageSent: (message: Message) => void;
}

export default function ReplyBox({
  conversationId,
  messages,
  onMessageSent,
}: Props) {
  const [text, setText] = useState("");
  const [suggesting, setSuggesting] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Cache: maps conversationId+lastMessageId → suggestion
  const suggestionCache = useRef<Record<string, string>>({});
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [text]);

  // Invalidate the suggestion cache entry for this conversation when a
  // new message arrives (the last message id changes).
  const lastMessageId = messages[messages.length - 1]?.id ?? "";
  const cacheKey = `${conversationId}:${lastMessageId}`;

  const handleSuggest = useCallback(async () => {
    // Return cached suggestion if available
    if (suggestionCache.current[cacheKey]) {
      setText(suggestionCache.current[cacheKey]);
      textareaRef.current?.focus();
      return;
    }

    setSuggesting(true);
    setError(null);

    try {
      const res = await fetch("/api/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages, conversationId }),
      });

      const data = (await res.json()) as { suggestion?: string; error?: string };

      if (!res.ok) {
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }

      const suggestion = data.suggestion ?? "";
      suggestionCache.current[cacheKey] = suggestion;
      setText(suggestion);
      textareaRef.current?.focus();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Suggestion failed");
    } finally {
      setSuggesting(false);
    }
  }, [cacheKey, conversationId, messages]);

  const handleSend = useCallback(async () => {
    const content = text.trim();
    if (!content || sending) return;

    setSending(true);
    setError(null);

    try {
      const res = await fetch(
        `/api/conversations/${conversationId}/messages`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content }),
        }
      );

      const data = (await res.json()) as Message & { error?: string };

      if (!res.ok) {
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }

      setText("");
      // Invalidate cache – a new message arrived so old suggestion is stale
      delete suggestionCache.current[cacheKey];
      onMessageSent(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to send message");
    } finally {
      setSending(false);
    }
  }, [cacheKey, conversationId, onMessageSent, sending, text]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      void handleSend();
    }
  };

  return (
    <div className="border-t border-gray-200 bg-white p-3">
      {error && (
        <p className="text-red-500 text-xs mb-2 px-1">{error}</p>
      )}

      <div className="flex items-end gap-2">
        {/* Suggest button */}
        <button
          onClick={() => void handleSuggest()}
          disabled={suggesting || messages.length === 0}
          title="Get an AI-powered reply suggestion"
          className={clsx(
            "shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-colors",
            "border border-amber-300 bg-amber-50 text-amber-700",
            "hover:bg-amber-100 disabled:opacity-40 disabled:cursor-not-allowed"
          )}
        >
          {suggesting ? (
            <span className="animate-spin text-base">⏳</span>
          ) : (
            <span className="text-base">💡</span>
          )}
          <span className="hidden sm:inline">
            {suggesting ? "Thinking…" : "Suggest"}
          </span>
        </button>

        {/* Text area */}
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
          placeholder="Write a reply… (⌘↵ to send)"
          className="flex-1 resize-none rounded-xl border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent overflow-hidden"
        />

        {/* Send button */}
        <button
          onClick={() => void handleSend()}
          disabled={!text.trim() || sending}
          className={clsx(
            "shrink-0 px-4 py-2 rounded-xl text-sm font-semibold transition-colors",
            "bg-blue-500 text-white hover:bg-blue-600",
            "disabled:opacity-40 disabled:cursor-not-allowed"
          )}
        >
          {sending ? "…" : "Send"}
        </button>
      </div>

      <p className="text-xs text-gray-400 mt-1.5 pl-1">
        ⌘ + Enter to send · Click 💡 for an AI suggestion
      </p>
    </div>
  );
}
