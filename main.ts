import { serve } from "https://deno.land/std@0.140.0/http/server.ts";
import { proxy } from "./src/proxy.ts";
import { streamWrapper, wrapper } from "./src/think.ts";
import { CompletionRequest } from "./src/raw.ts";
import { search } from "./src/search.ts";
import { extractPDFFromMessage } from "./src/pdf.ts";

const target = Deno.env.get("TARGET") ?? "https://lemonade.easonabc.eu.org";

serve(async (req: Request) => {
  const url = new URL(req.url);

  if (
    req.method == "POST" && url.pathname.endsWith("/api/v1/chat/completions")
  ) {
    const endpoint = target + url.pathname;
    const reqJson = await req.json() as CompletionRequest;

    if (reqJson.messages) {
      extractPDFFromMessage(reqJson.messages);
    }

    let reqInit = {
      method: req.method,
      headers: req.headers,
      body: JSON.stringify({ ...reqJson }),
    } as RequestInit;
    if (reqJson.model?.endsWith(":online")) {
      reqInit = await search(endpoint, reqInit);
    }

    if (!reqJson.stream) return fetch(endpoint, reqInit).then(wrapper);

    console.info("Handle stream request");

    const res = await fetch(endpoint, reqInit);
    const resStream = res.body == null ? null : streamWrapper(res.body);

    return new Response(resStream, {
      headers: {
        ...res.headers,
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
      status: res.status,
    });
  }

  return proxy(req, target);
}, {
  port: 8002,
  hostname: "0.0.0.0",
});
