import { tavily, TavilySearchResponse } from "@tavily/core";
import { CompletionRequest } from "./raw.ts";
import { wrapper } from "./think.ts";

const apiKey = Deno.env.get("TAVILY_API_KEY");
const client = tavily({ apiKey });

function getPrompt(): string {
  const now = new Date();

  const queryGenPrompt = [
    "Given the user's message and interaction history, decide if a web search is necessary.",
    "You must be **concise** exclusively provide a search query if one is necessary.",
    "Refrain from verbose responses or any additional commentary.",
    "Prefer suggesting a search if uncertain to provide comprehensive or updated information.",
    "If a search isn't needed at all, respond with an empty string.",
    "Default to a search query when in doubt. Today's date is {{CURRENT_DATE}}.",
    "",
    "Examples:",
    "",
    // --------- 必要搜尋 ---------
    "User: 'What’s the weather like today?'",
    "Search Query: 'weather today'",
    "---",
    "",
    "User: 'What’s the latest iPhone price in Taiwan?'",
    "Search Query: 'iPhone price Taiwan 2025'",
    "---",
    "",
    "User: 'How many calories are in a banana?'",
    "Search Query: 'banana calories'",
    "---",
    "",
    "User: 'Who is the current president of the United States?'",
    "Search Query: 'current US president'",
    "---",
    "",
    "User: 'Explain quantum entanglement in simple terms.'",
    "Search Query: ''",
    "---",
    "",
    "User: 'What is the capital of Canada?'",
    "Search Query: ''",
    "---",
    "",
    // --------- 不確定時保守搜尋 ---------
    "User: 'Give me the best recipe for chocolate cake.'",
    "Search Query: 'best chocolate cake recipe'",
    "---",
    "",
    // --------- 其他情境 ---------
    "User: 'When does daylight saving time start in Europe this year?'",
    "Search Query: 'Europe daylight saving start 2025'",
    "---",
    "",
    "User: 'Show me the stock price of Tesla as of today.'",
    "Search Query: 'Tesla stock price today'",
    "---",
  ].join("\n");
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
  }).then(wrapper).then((r) => {
    console.log("Response status for query generation:", r.status);
    return r.json();
  });

  let query = res.choices?.[0]?.message?.content as string | undefined;

  if (query == undefined || query?.length == 0) return;

  query = query.replace(/^(Search|query|\s|:|_)*/i, "");

  if (query.length > 200) console.warn("generated query too long", { query });
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

  const messages = (body.messages ?? []).filter((m) => m.role !== "system");

  body.model = body.model?.replace(/\:online$/, "");

  body.messages = [
    contextMessage,
    ...messages,
  ];

  return {
    ...request,
    body: JSON.stringify(body),
  };
}
