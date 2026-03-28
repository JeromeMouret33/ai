/**
 * app.config.example.ts — Configuration template.
 *
 * Copy this file to app.config.ts and fill in your values.
 * app.config.ts is gitignored and will never be committed.
 *
 *   cp app.config.example.ts app.config.ts
 */

import type { AppConfig } from "./src/lib/config";

const config: AppConfig = {
  /**
   * External chat service
   * ─────────────────────
   * baseUrl  : base URL without trailing slash
   * apiKey   : authentication token / key
   * auth     : 'bearer' → "Authorization: Bearer <key>"
   *            'api-key' → "X-API-Key: <key>"
   */
  chat: {
    baseUrl: "https://api.example.com/v1",
    apiKey: "REPLACE_ME",
    auth: "bearer",
  },

  /**
   * OpenAI — server-side only, never exposed to the browser
   * ─────────────────────────────────────────────────────────
   * model          : 'gpt-4o' (best) or 'gpt-4o-mini' (cheaper)
   * contextMessages: number of last messages sent to OpenAI (keep low to save tokens)
   */
  openai: {
    apiKey: "sk-REPLACE_ME",
    model: "gpt-4o",
    maxTokens: 300,
    temperature: 0.7,
    contextMessages: 5,
  },

  /**
   * App behaviour
   * ─────────────
   * conversationPollMs : how often the sidebar refreshes (ms)
   * messagePollMs      : how often the message thread refreshes (ms)
   */
  app: {
    conversationPollMs: 15_000,
    messagePollMs: 5_000,
  },
};

export default config;
