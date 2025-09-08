import * as OpenCC from "opencc-js";
import { CompletionResponse } from "./raw.ts";

const openccConverter = OpenCC.Converter({ from: "cn", to: "twp" });

export function streamWrapper(
  stream: ReadableStream<Uint8Array>,
): ReadableStream<Uint8Array> {
  const reader = stream.getReader();
  if (!reader) {
    throw new Error("Response body is not readable");
  }

  let inReasoning = false;
  const decoder = new TextDecoder();
  let buffer = "";

  const body = new ReadableStream({
    async start(controller) {
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          while (true) {
            const lineEnd = buffer.indexOf("\n");
            if (lineEnd === -1) break;

            const line = buffer.slice(0, lineEnd).trim();

            buffer = buffer.slice(lineEnd + 1);

            if (line.startsWith("data: ")) {
              const data = line.slice(6);
              if (data === "[DONE]") break;

              let parsed;

              try {
                parsed = JSON.parse(data);
              } catch (e) {
                console.warn("Failed to parse JSON:", e);
                continue;
              }

              const choice = parsed.choices[0];

              const { content, reasoning } = choice.delta;
              let text = `${content || ""}${reasoning || ""}`;

              if (text == "<think>") inReasoning = true;
              else if (text == "</think>") inReasoning = false;
              else {
                text = openccConverter(text);

                if (inReasoning) {
                  choice.delta.content = "";
                  choice.delta.reasoning = text;
                }
                parsed.choices[0] = choice;
                const modifiedData = JSON.stringify(parsed);
                const modifiedLine = `data: ${modifiedData}\n`;
                controller.enqueue(new TextEncoder().encode(modifiedLine));
              }
            } else {
              controller.enqueue(new TextEncoder().encode(line + "\n"));
            }
          }
        }
      } finally {
        reader.cancel();
        controller.close();
      }
    },
    cancel() {
      reader.cancel();
    },
  });

  return body;
}

function extractReasoning(
  content: string,
): { content: string; reasoning: string | null } {
  const reasoningRegex = /<think>([\s\S]*?)<\/think>/;
  const match = content.match(reasoningRegex);
  if (match) {
    return {
      content: content.replace(reasoningRegex, "").trim(),
      reasoning: match[1].trim(),
    };
  }
  return { content, reasoning: null };
}

export async function wrapper(response: Response): Promise<Response> {
  const body = await response.json() as CompletionResponse;

  body.choices = body.choices.map((choice) => {
    if (choice.message?.content) {
      const { content, reasoning } = extractReasoning(choice.message.content);
      if (reasoning) choice.reasoning += reasoning;
      choice.message.content = openccConverter(content);
    }
    return choice;
  });

  return new Response(JSON.stringify(body), {
    headers: response.headers,
    status: response.status,
  });
}
