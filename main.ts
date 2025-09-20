import { serve } from "https://deno.land/std/http/server.ts";
import { proxy } from "./src/proxy.ts";
import { extractPDFFromMessage } from "./src/features/pdf_extraction.ts";
import { search } from "./src/features/search.ts";
import { streamWrapper, wrapper } from "./src/features/think_tag.ts";
import { CompletionRequest } from "./src/types.ts";

const UPSTREAM_API = Deno.env.get("UPSTREAM_API")!.replace(/\/+$/, "");

if (UPSTREAM_API == undefined) throw new Error("TARGET is not defined");

console.info(`Upstream: ${UPSTREAM_API}`);

async function handler(req: Request): Promise<Response> {
  const { pathname } = new URL(req.url);

  if (pathname.endsWith("/chat/completions")) {
    const body = await req.json() as CompletionRequest;

    await extractPDFFromMessage(body.messages);

    let searchRes;
    let requestInit: RequestInit = {
      headers: req.headers,
      body: JSON.stringify(body),
      method: "POST",
    };

    if (body.model?.endsWith(":online")) {
      [requestInit, searchRes] = await search(
        UPSTREAM_API + pathname,
        requestInit,
      );
    }

    const res = await fetch(UPSTREAM_API + pathname, requestInit);

    if (body.stream) {
      return new Response(streamWrapper(res.body!, searchRes), {
        headers: res.headers,
        status: res.status,
      });
    } else {
      const response = await wrapper(res);
      if (searchRes) {
        const body = await response.json();
        body.choices[0].message.content += "\n\n" +
          searchRes.results.map((r: any) => {
            return `<citation>
            <title>${r.title}</title>
            <url>${r.url}</url>
            ${
              searchRes.favicon == undefined
                ? ""
                : `<favicon>${searchRes.favicon}</favicon>`
            }
          </citation>`;
          }).join("\n\n");
        return new Response(JSON.stringify(body), {
          headers: response.headers,
          status: response.status,
        });
      }
      return response;
    }
  }

  return proxy(req, UPSTREAM_API + pathname);
}

serve(handler, { port: 8002, hostname: "0.0.0.0" });
