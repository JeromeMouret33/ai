export interface Conversation {
  id: string;
  /** Display name or contact name */
  name: string;
  /** Last message preview */
  lastMessage?: string;
  /** ISO timestamp of the last message */
  lastMessageAt?: string;
  /** Number of unread messages */
  unreadCount: number;
  /** Optional avatar URL */
  avatarUrl?: string;
}

export type MessageRole = "user" | "contact" | "system";

export interface Message {
  id: string;
  conversationId: string;
  /** Who sent the message: "user" = you, "contact" = the other person */
  role: MessageRole;
  content: string;
  /** ISO timestamp */
  createdAt: string;
}

export interface SuggestRequest {
  messages: Message[];
  conversationId: string;
}

export interface SuggestResponse {
  suggestion: string;
}

export interface ApiError {
  error: string;
}

// ─── Chat API adapter types ──────────────────────────────────────────────────
// These mirror what your external chat service actually returns.
// Adjust the field names in src/lib/chat-api.ts if they differ.

export interface RawConversation {
  id: string;
  name?: string;
  title?: string;
  last_message?: string;
  lastMessage?: string;
  last_message_at?: string;
  lastMessageAt?: string;
  unread_count?: number;
  unreadCount?: number;
  avatar_url?: string;
  avatarUrl?: string;
  [key: string]: unknown;
}

export interface RawMessage {
  id: string;
  conversation_id?: string;
  conversationId?: string;
  role?: MessageRole;
  /** Some APIs use "from" or "sender" instead of "role" */
  from?: string;
  sender?: string;
  direction?: "inbound" | "outbound";
  content?: string;
  text?: string;
  body?: string;
  created_at?: string;
  createdAt?: string;
  timestamp?: string;
  [key: string]: unknown;
}
