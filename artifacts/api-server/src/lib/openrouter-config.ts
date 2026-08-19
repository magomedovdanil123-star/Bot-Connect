const DEFAULT_MODEL = "qwen/qwen3.7-flash";

export const openRouterConfig = {
  url: "https://openrouter.ai/api/v1/chat/completions",
  get apiKey(): string {
    return process.env["OPENROUTER_API_KEY"] ?? "";
  },
  get model(): string {
    return process.env["OPENROUTER_MODEL"] || DEFAULT_MODEL;
  },
};