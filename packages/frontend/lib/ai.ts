import { getServerConfig } from "@/lib/config";

export class AiProviderError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "AiProviderError";
    this.status = status;
  }
}

/** Calls an OpenAI-compatible chat completions endpoint. */
export async function generateAnswer(question: string): Promise<string> {
  const config = getServerConfig();

  if (!config.aiApiKey) {
    throw new AiProviderError("AI provider is not configured.", 500);
  }

  const res = await fetch(`${config.aiBaseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.aiApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: config.aiModel,
      temperature: 0.7,
      messages: [
        {
          role: "system",
          content: "You are a helpful assistant that answers user questions clearly and concisely.",
        },
        { role: "user", content: question },
      ],
    }),
  });

  if (!res.ok) {
    let detail = "";
    try {
      detail = await res.text();
    } catch {
      detail = "";
    }
    console.error("AI provider error:", res.status, detail);
    throw new AiProviderError("Unable to generate a response from the AI provider.", res.status);
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const answer = data.choices?.[0]?.message?.content?.trim();
  if (!answer) {
    throw new AiProviderError("The AI provider returned an empty response.", 502);
  }
  return answer;
}
