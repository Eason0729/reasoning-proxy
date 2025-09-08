import { tavily, TavilySearchResponse } from "@tavily/core";
import { CompletionRequest } from "./raw.ts";

const apiKey = Deno.env.get("TAVILY_API_KEY");
const client = tavily({ apiKey });

function getPrompt(): string {
  const now = new Date();
  const queryGenPrompt =
    "Given the user's message and interaction history, decide if a web search is necessary. You must be **concise** and exclusively provide a search query if one is necessary. Refrain from verbose responses or any additional commentary. Prefer suggesting a search if uncertain to provide comprehensive or updated information. If a search isn't needed at all, respond with an empty string. Default to a search query when in doubt. Today's date is {{CURRENT_DATE}}.\n Examples:\nUser: 'What's the weather like today?'\nSearch Query: 'weather today'\n---\nUser: 'Who won the World Series in 2020?'\nSearch Query: '2020 World Series winner'\n---";
  return queryGenPrompt.replace(
    "{{CURRENT_DATE}}",
    now.toISOString().split("T")[0],
  );
}

function getBody<T>(request: RequestInit): T | undefined {
  let body: T;

  // Handle both string and object cases for request.body
  if (typeof request.body === "string") {
    try {
      body = JSON.parse(request.body) as T;
      return body;
    } catch (error) {
      console.error("Failed to parse request body:", error);
      return undefined;
    }
  } else if (typeof request.body === "object" && request.body !== null) {
    body = request.body as T;
    return body;
  } else {
    console.error("Invalid request body type:", typeof request.body);
    return undefined;
  }
}

async function getOnlineContext(
  endpoint: string,
  request: RequestInit,
): Promise<TavilySearchResponse | undefined> {
  const body = getBody<CompletionRequest>(request)!;

  const infoMessage = body.messages!.filter((m) => m.role !== "system")
    .slice(-5);

  if (infoMessage.length == 0) return;

  const systemMessage = {
    role: "system",
    content: getPrompt(),
  };
  body.messages = [systemMessage, ...infoMessage];
  body.stream = false;

  body.model = body.model?.replace(/\:online$/, "");

  const res = await fetch(endpoint, {
    ...request,
    body: JSON.stringify(body),
  }).then((r) => r.json());

  const query = res.choices?.[0]?.message?.content as string;

  if (query.length > 200) console.warn("generated query too long");
  else console.log("Generated search query:", query);

  try {
    return await client.search(query, { country: "taiwan" });
  } catch (e) {
    console.error(e);
  }
}

const searchContextTemplate =
  `## Context information from web search:\nQuery: {{QUERY}}\nResults:\n{{RESULTS}}`;

export async function search(
  endpoint: string,
  request: RequestInit,
): Promise<RequestInit> {
  const searchRes = await getOnlineContext(endpoint, request);
  if (!searchRes) return request;

  const contextMessage = {
    role: "system",
    content: searchContextTemplate.replace("{{QUERY}}", searchRes.query)
      .replace(
        "{{RESULTS}}",
        JSON.stringify(searchRes.results, null, 2),
      ),
  };

  const body = getBody<CompletionRequest>(request)!;

  body.model = body.model?.replace(/\:online$/, "");
  body.messages = [
    contextMessage,
    ...(body.messages ?? []),
  ];

  return {
    ...request,
    body: JSON.stringify(body),
  };
}
