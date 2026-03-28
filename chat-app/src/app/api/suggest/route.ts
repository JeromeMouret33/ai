/**
 * POST /api/suggest
 *
 * Body: { messages: Message[], conversationId: string }
 *
 * Takes the last 5 messages, sends them to GPT-4o, and returns
 * { suggestion: string }.
 *
 * The OpenAI key is read server-side only — never exposed to the client.
 */

import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import type { SuggestRequest, SuggestResponse, ApiError, Message } from "@/types";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const SYSTEM_PROMPT = `Tu es un assistant qui aide à rédiger des réponses de chat.
Analyse les derniers messages et propose une réponse naturelle,
concise et adaptée au ton de la conversation.
Réponds uniquement avec le texte de la réponse, sans explication.`;

function toOpenAIRole(role: Message["role"]): "user" | "assistant" | "system" {
  if (role === "user") return "assistant"; // "user" in our app = the agent replying
  if (role === "contact") return "user";   // "contact" = the customer writing in
  return "system";
}

export async function POST(
  req: NextRequest
): Promise<NextResponse<SuggestResponse | ApiError>> {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY is not configured" },
      { status: 500 }
    );
  }

  let body: SuggestRequest;
  try {
    body = (await req.json()) as SuggestRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { messages, conversationId } = body;

  if (!Array.isArray(messages) || !conversationId) {
    return NextResponse.json(
      { error: "messages (array) and conversationId (string) are required" },
      { status: 400 }
    );
  }

  // Use only the last 5 messages to minimise token usage
  const context = messages.slice(-5);

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        ...context.map((m) => ({
          role: toOpenAIRole(m.role),
          content: m.content,
        })),
      ],
      max_tokens: 300,
      temperature: 0.7,
    });

    const suggestion =
      completion.choices[0]?.message?.content?.trim() ?? "";

    return NextResponse.json({ suggestion });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[/api/suggest] OpenAI error:", message);
    return NextResponse.json(
      { error: `OpenAI request failed: ${message}` },
      { status: 502 }
    );
  }
}
