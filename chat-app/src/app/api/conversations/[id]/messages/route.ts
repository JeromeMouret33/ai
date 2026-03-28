import { NextRequest, NextResponse } from "next/server";
import { getMessages, sendMessage } from "@/lib/chat-api";
import type { ApiError, Message } from "@/types";

type Params = { params: Promise<{ id: string }> };

export async function GET(
  _req: NextRequest,
  { params }: Params
): Promise<NextResponse<Message[] | ApiError>> {
  const { id } = await params;
  try {
    const messages = await getMessages(id);
    return NextResponse.json(messages);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[GET /api/conversations/${id}/messages]`, message);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: Params
): Promise<NextResponse<Message | ApiError>> {
  const { id } = await params;
  try {
    const body = (await req.json()) as { content: string };
    if (!body.content?.trim()) {
      return NextResponse.json({ error: "content is required" }, { status: 400 });
    }
    const message = await sendMessage(id, body.content.trim());
    return NextResponse.json(message, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[POST /api/conversations/${id}/messages]`, message);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
