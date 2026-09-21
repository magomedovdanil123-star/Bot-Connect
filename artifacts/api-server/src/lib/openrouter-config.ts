const DEFAULT_MODEL = "openai/gpt-5-nano";

export const openRouterConfig = {
  url: "https://openrouter.ai/api/v1/chat/completions",
  get apiKey(): string {
    return process.env["OPENROUTER_API_KEY"] ?? "";
  },
  get model(): string {
    return process.env["OPENROUTER_MODEL"] || DEFAULT_MODEL;
  },
};