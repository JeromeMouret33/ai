/**
 * Shared types + server-side config loader.
 *
 * API routes and server utilities import from here — never from the browser.
 */

export interface AppConfig {
  chat: {
    baseUrl: string;
    apiKey: string;
    auth: "bearer" | "api-key";
  };
  openai: {
    apiKey: string;
    model: string;
    maxTokens: number;
    temperature: number;
    contextMessages: number;
  };
  app: {
    conversationPollMs: number;
    messagePollMs: number;
  };
}

// Dynamic import so missing app.config.ts fails with a clear message at runtime
// rather than a cryptic module-not-found error at build time.
let _config: AppConfig | null = null;

export function getConfig(): AppConfig {
  if (_config) return _config;

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require("../../app.config") as { default: AppConfig };
    _config = mod.default;
  } catch {
    throw new Error(
      "app.config.ts not found. Copy app.config.example.ts → app.config.ts and fill in your values."
    );
  }

  return _config;
}
