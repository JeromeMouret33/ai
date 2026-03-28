import { NextResponse } from "next/server";
import { getConversations } from "@/lib/chat-api";
import type { ApiError, Conversation } from "@/types";

export async function GET(): Promise<
  NextResponse<Conversation[] | ApiError>
> {
  try {
    const conversations = await getConversations();
    return NextResponse.json(conversations);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[GET /api/conversations]", message);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
