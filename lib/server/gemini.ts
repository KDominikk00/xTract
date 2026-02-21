import "server-only";

type MessageRole = "user" | "assistant";

export type AIChatTurn = {
  role: MessageRole;
  content: string;
};

type GenerateInput = {
  systemPrompt: string;
  history?: AIChatTurn[];
  userPrompt: string;
  temperature?: number;
  maxOutputTokens?: number;
  responseMimeType?: "application/json" | "text/plain";
};

type GeminiGenerateResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
  error?: {
    message?: string;
  };
};

const DEFAULT_MODEL = process.env.GEMINI_MODEL ?? "gemini-2.5-flash-lite";

function mapRole(role: MessageRole): "user" | "model" {
  return role === "assistant" ? "model" : "user";
}

export async function generateGeminiText({
  systemPrompt,
  history = [],
  userPrompt,
  temperature = 0.3,
  maxOutputTokens = 600,
  responseMimeType = "text/plain",
}: GenerateInput): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("Missing GEMINI_API_KEY");
  }

  const contents = [
    ...history.map((turn) => ({
      role: mapRole(turn.role),
      parts: [{ text: turn.content }],
    })),
    {
      role: "user" as const,
      parts: [{ text: userPrompt }],
    },
  ];

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${DEFAULT_MODEL}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: systemPrompt }],
        },
        contents,
        generationConfig: {
          temperature,
          maxOutputTokens,
          responseMimeType,
        },
      }),
    }
  );

  const json = (await res.json()) as GeminiGenerateResponse;
  if (!res.ok) {
    throw new Error(json.error?.message ?? "Gemini request failed");
  }

  const text =
    json.candidates?.[0]?.content?.parts
      ?.map((part) => part.text ?? "")
      .join("\n")
      .trim() ?? "";

  if (!text) {
    throw new Error("Gemini returned an empty response");
  }

  return text;
}
