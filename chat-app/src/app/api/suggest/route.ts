/**
 * POST /api/suggest
 *
 * Body   : { messages: Message[], conversationId: string }
 * Returns: { suggestion: string }
 *
 * Calls OpenAI server-side only. The API key is never sent to the browser.
 */

import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { getConfig } from "@/lib/config";
import type { SuggestRequest, SuggestResponse, ApiError, Message } from "@/types";

const SYSTEM_PROMPT = `Tu es un assistant qui aide à rédiger des réponses de chat.
Analyse les derniers messages et propose une réponse naturelle,
concise et adaptée au ton de la conversation.
Réponds uniquement avec le texte de la réponse, sans explication.`;

function toOpenAIRole(role: Message["role"]): "user" | "assistant" {
  // In this context: "user" = the agent (us) → assistant role for GPT
  //                  "contact" = the customer → user role for GPT
  return role === "user" ? "assistant" : "user";
}

export async function POST(
  req: NextRequest
): Promise<NextResponse<SuggestResponse | ApiError>> {
  const { openai: cfg } = getConfig();

  if (!cfg.apiKey || cfg.apiKey.startsWith("sk-REPLACE")) {
    return NextResponse.json(
      { error: "OpenAI API key is not configured in app.config.ts" },
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

  const client = new OpenAI({ apiKey: cfg.apiKey });
  const context = messages.slice(-cfg.contextMessages);

  try {
    const completion = await client.chat.completions.create({
      model: cfg.model,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        ...context
          .filter((m) => m.role !== "system")
          .map((m) => ({ role: toOpenAIRole(m.role), content: m.content })),
      ],
      max_tokens: cfg.maxTokens,
      temperature: cfg.temperature,
    });

    const suggestion = completion.choices[0]?.message?.content?.trim() ?? "";
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
