/**
 * Server-side HTTP client for the external chat service.
 *
 * All connection settings come from app.config.ts — never from process.env.
 */

import { getConfig } from "@/lib/config";
import type {
  Conversation,
  Message,
  RawConversation,
  RawMessage,
  MessageRole,
} from "@/types";

// ─── HTTP helper ─────────────────────────────────────────────────────────────

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const { chat } = getConfig();

  const authHeader =
    chat.auth === "bearer"
      ? { Authorization: `Bearer ${chat.apiKey}` }
      : { "X-API-Key": chat.apiKey };

  const res = await fetch(`${chat.baseUrl}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...authHeader,
      ...init?.headers,
    },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`[chat-api] ${res.status} ${res.statusText} — ${body}`);
  }

  return res.json() as Promise<T>;
}

// ─── Normalisation ────────────────────────────────────────────────────────────

function normaliseConversation(raw: RawConversation): Conversation {
  return {
    id: String(raw.id),
    name: String(raw.name ?? raw.title ?? `Conversation ${raw.id}`),
    lastMessage: (raw.last_message ?? raw.lastMessage) as string | undefined,
    lastMessageAt: (raw.last_message_at ?? raw.lastMessageAt) as string | undefined,
    unreadCount: Number(raw.unread_count ?? raw.unreadCount ?? 0),
    avatarUrl: (raw.avatar_url ?? raw.avatarUrl) as string | undefined,
  };
}

function resolveRole(raw: RawMessage): MessageRole {
  if (raw.role === "user" || raw.role === "contact" || raw.role === "system") {
    return raw.role;
  }
  if (raw.direction === "outbound") return "user";
  if (raw.direction === "inbound") return "contact";
  const from = String(raw.from ?? raw.sender ?? "").toLowerCase();
  if (from === "agent" || from === "user" || from === "me") return "user";
  return "contact";
}

function normaliseMessage(raw: RawMessage, conversationId: string): Message {
  return {
    id: String(raw.id),
    conversationId: String(raw.conversation_id ?? raw.conversationId ?? conversationId),
    role: resolveRole(raw),
    content: String(raw.content ?? raw.text ?? raw.body ?? ""),
    createdAt: String(raw.created_at ?? raw.createdAt ?? raw.timestamp ?? new Date().toISOString()),
  };
}

// ─── Public functions ─────────────────────────────────────────────────────────

export async function getConversations(): Promise<Conversation[]> {
  const data = await apiFetch<RawConversation[] | { data: RawConversation[] }>("/conversations");
  const list = Array.isArray(data) ? data : data.data;
  return list.map(normaliseConversation);
}

export async function getMessages(conversationId: string): Promise<Message[]> {
  const data = await apiFetch<RawMessage[] | { data: RawMessage[] }>(
    `/conversations/${conversationId}/messages`
  );
  const list = Array.isArray(data) ? data : data.data;
  return list.map((m) => normaliseMessage(m, conversationId));
}

export async function sendMessage(conversationId: string, content: string): Promise<Message> {
  const raw = await apiFetch<RawMessage>(
    `/conversations/${conversationId}/messages`,
    { method: "POST", body: JSON.stringify({ content }) }
  );
  return normaliseMessage(raw, conversationId);
}
