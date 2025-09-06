import { serve } from "https://deno.land/std@0.140.0/http/server.ts";
import { proxy } from "./src/proxy.ts";
import { streamWrapper } from "./src/stream.ts";

const target = Deno.env.get("TARGET") ?? "https://lemonade.easonabc.eu.org";

serve(async (req: Request) => {
  const url = new URL(req.url);

  if (
    req.method == "POST" && url.pathname.startsWith("/api/v1/chat/completions")
  ) {
    const reqJson = await req.json();
    if (
      typeof reqJson === "object" && reqJson !== null && "stream" in reqJson &&
      reqJson.stream == true
    ) {
      console.info("Handle stream request");
      const res = await fetch(target + url.pathname, {
        method: req.method,
        headers: req.headers,
        body: JSON.stringify({ ...reqJson, stream: true }),
      });
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

    return fetch(target + url.pathname, {
      method: req.method,
      headers: req.headers,
      body: JSON.stringify(reqJson),
    });
  }

  return proxy(req, target);
}, {
  port: 8002,
});
