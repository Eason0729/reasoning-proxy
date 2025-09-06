export function proxy(res: Request, target: string): Promise<Response> {
  const url = new URL(res.url);

  url.host = target.replace(/^https?:\/\//, "");
  url.protocol = target.split("://")[0];

  const requestHeaders = new Headers(res.headers);

  requestHeaders.set("host", url.host);
  requestHeaders.set("origin", target);
  requestHeaders.set("referer", target + "/");

  const request = new Request(url.toString(), {
    method: res.method,
    headers: requestHeaders,
    body: res.body,
    redirect: "manual",
  });

  return fetch(request);
}
