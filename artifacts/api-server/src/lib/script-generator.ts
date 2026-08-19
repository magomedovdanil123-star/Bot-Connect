const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const MODEL = "qwen/qwen3.7-flash";

type ChatMessage = {
  role: "system" | "user";
  content: string;
};

type OpenRouterResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
  error?: {
    message?: string;
  };
};

const systemPrompt = [
  "Ты профессиональный сценарист коротких вертикальных видео для TikTok, Reels и Shorts.",
  "Создавай сценарий на русском языке, если пользователь не попросил другой язык.",
  "Структура ответа:",
  "1. Название и идея ролика.",
  "2. Хук первых 2-3 секунд.",
  "3. Сценарий по сценам с примерным таймингом.",
  "4. Текст диктора или реплик.",
  "5. Текстовые подсказки на экране.",
  "6. Финальный призыв к действию.",
  "7. Короткие рекомендации по съёмке.",
  "Пиши конкретно, живо и так, чтобы сценарий можно было сразу использовать для ролика до 60 секунд.",
].join("\n");

export async function generateVideoScript(topic: string): Promise<string> {
  const apiKey = process.env["OPENROUTER_API_KEY"];
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is not configured");
  }

  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
    {
      role: "user",
      content: `Создай структурированный сценарий короткого вертикального видео на тему: ${topic}`,
    },
  ];

  const response = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://replit.com",
      "X-Title": "AI Video Script Bot",
    },
    body: JSON.stringify({
      model: MODEL,
      messages,
      max_tokens: 8192,
      temperature: 0.8,
    }),
  });

  const data = (await response.json()) as OpenRouterResponse;
  if (!response.ok) {
    throw new Error(data.error?.message ?? `OpenRouter request failed (${response.status})`);
  }

  const content = data.choices?.[0]?.message?.content?.trim();
  if (!content) {
    throw new Error("OpenRouter returned an empty response");
  }

  return content;
}