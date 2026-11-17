import { config } from "./config.js";

export function aiConfigured() {
  return Boolean(config.aiBase && config.aiModel);
}

export async function aiJson(
  instructions: string,
  data: unknown,
): Promise<unknown> {
  const response = await fetch(
    config.aiBase.replace(/\/$/, "") + "/chat/completions",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(config.aiKey ? { Authorization: `Bearer ${config.aiKey}` } : {}),
      },
      signal: AbortSignal.timeout(45000),
      body: JSON.stringify({
        model: config.aiModel,
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: instructions },
          { role: "user", content: JSON.stringify(data) },
        ],
      }),
    },
  );
  if (!response.ok) throw new Error(`KI-Dienst HTTP ${response.status}`);
  const body = await response.json();
  return JSON.parse(body.choices?.[0]?.message?.content || "{}");
}
