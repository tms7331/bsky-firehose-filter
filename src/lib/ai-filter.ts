import OpenAI from "openai";
import type { JetstreamPost } from "./jetstream";

let client: OpenAI | null = null;

function getClient() {
  if (!client) {
    client = new OpenAI({
      baseURL: "https://openrouter.ai/api/v1",
      apiKey: process.env.OPENROUTER_API_KEY || "",
    });
  }
  return client;
}

export async function filterPosts(
  posts: JetstreamPost[],
  prompt: string,
  maxMatches: number = 5
): Promise<JetstreamPost[]> {
  const postList = posts.map((p, i) => `[${i}] ${p.text}`).join("\n");

  const model = process.env.OPENROUTER_MODEL || "meta-llama/llama-3.3-70b-instruct";
  const provider = process.env.OPENROUTER_PROVIDER || "Groq";

  const messages: OpenAI.ChatCompletionMessageParam[] = [
    {
      role: "system",
      content: `You are a content filter for social media posts. You receive a batch of numbered posts and a filter criteria from the user. Return a JSON array of the indices (0-based) of posts that best match the criteria. Return ONLY the JSON array, nothing else. Return at most ${maxMatches} matches. If no posts match, return [].`,
    },
    {
      role: "user",
      content: `Filter criteria: ${prompt}\n\nPosts:\n${postList}\n\nReturn matching indices as a JSON array:`,
    },
  ];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const params: any = {
    model,
    messages,
    temperature: 0.1,
    max_tokens: 200,
  };

  // Add OpenRouter provider preference if configured
  if (provider) {
    params.provider = { order: [provider] };
  }

  const response = await getClient().chat.completions.create(params);

  const content = response.choices[0]?.message?.content?.trim();
  if (!content) return [];

  try {
    const match = content.match(/\[[\d,\s]*\]/);
    if (!match) return [];
    const indices: number[] = JSON.parse(match[0]);
    return indices
      .filter((i) => Number.isInteger(i) && i >= 0 && i < posts.length)
      .map((i) => posts[i]);
  } catch {
    console.error("[ai-filter] failed to parse response:", content);
    return [];
  }
}
