/**
 * Server-side client for the external chat API.
 *
 * Reads two environment variables (set in .env.local):
 *   CHAT_API_BASE_URL  – base URL, e.g. https://api.mychat.com/v1
 *   CHAT_API_KEY       – bearer / API key for authentication
 *
 * The normalisation functions below map the raw API shapes to the internal
 * Conversation / Message types.  Adjust field names here if your API returns
 * different keys (see the RawConversation / RawMessage types in src/types/).
 */

import type {
  Conversation,
  Message,
  RawConversation,
  RawMessage,
  MessageRole,
} from "@/types";

const BASE_URL = process.env.CHAT_API_BASE_URL ?? "";
const API_KEY = process.env.CHAT_API_KEY ?? "";

if (!BASE_URL && process.env.NODE_ENV !== "test") {
  console.warn("[chat-api] CHAT_API_BASE_URL is not set");
}

// ─── HTTP helper ─────────────────────────────────────────────────────────────

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${API_KEY}`,
      // Some APIs use a different header – swap the line above for:
      // "X-API-Key": API_KEY,
      ...init?.headers,
    },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`[chat-api] ${res.status} ${res.statusText} – ${body}`);
  }

  return res.json() as Promise<T>;
}

// ─── Normalisation helpers ────────────────────────────────────────────────────

function normaliseConversation(raw: RawConversation): Conversation {
  return {
    id: String(raw.id),
    name:
      (raw.name ?? raw.title ?? `Conversation ${raw.id}`) as string,
    lastMessage: (raw.last_message ?? raw.lastMessage) as string | undefined,
    lastMessageAt: (raw.last_message_at ?? raw.lastMessageAt) as
      | string
      | undefined,
    unreadCount: Number(raw.unread_count ?? raw.unreadCount ?? 0),
    avatarUrl: (raw.avatar_url ?? raw.avatarUrl) as string | undefined,
  };
}

/**
 * Maps the raw message role to our internal "user" | "contact" | "system".
 * Adjust the mapping below to match what your API returns.
 */
function resolveRole(raw: RawMessage): MessageRole {
  // Explicit role field
  if (raw.role === "user" || raw.role === "contact" || raw.role === "system") {
    return raw.role;
  }
  // "direction" convention (e.g. Intercom, Crisp…)
  if (raw.direction === "outbound") return "user";
  if (raw.direction === "inbound") return "contact";
  // "from" or "sender" convention
  const from = (raw.from ?? raw.sender ?? "").toString().toLowerCase();
  if (from === "agent" || from === "user" || from === "me") return "user";
  return "contact";
}

function normaliseMessage(raw: RawMessage, conversationId: string): Message {
  return {
    id: String(raw.id),
    conversationId:
      String(raw.conversation_id ?? raw.conversationId ?? conversationId),
    role: resolveRole(raw),
    content: String(raw.content ?? raw.text ?? raw.body ?? ""),
    createdAt: String(
      raw.created_at ?? raw.createdAt ?? raw.timestamp ?? new Date().toISOString()
    ),
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function getConversations(): Promise<Conversation[]> {
  // Adjust the path if your API uses a different endpoint
  const data = await apiFetch<RawConversation[] | { data: RawConversation[] }>(
    "/conversations"
  );
  const list = Array.isArray(data) ? data : data.data;
  return list.map(normaliseConversation);
}

export async function getMessages(conversationId: string): Promise<Message[]> {
  // Adjust the path if your API uses a different endpoint
  const data = await apiFetch<RawMessage[] | { data: RawMessage[] }>(
    `/conversations/${conversationId}/messages`
  );
  const list = Array.isArray(data) ? data : data.data;
  return list.map((m) => normaliseMessage(m, conversationId));
}

export async function sendMessage(
  conversationId: string,
  content: string
): Promise<Message> {
  const data = await apiFetch<RawMessage>(
    `/conversations/${conversationId}/messages`,
    {
      method: "POST",
      body: JSON.stringify({ content }),
    }
  );
  return normaliseMessage(data, conversationId);
}
