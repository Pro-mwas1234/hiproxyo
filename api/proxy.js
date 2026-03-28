import parseURL from "../src/lib/parseURL.js";
import { isValidHostName } from "../src/lib/isValidHostName.js";

export const config = {
  runtime: "edge", // or "nodejs"
};

export default async function handler(req) {
  const url = new URL(req.url);
  const targetUrl = url.searchParams.get("url") || req.query?.url;

  if (!targetUrl) {
    return new Response(JSON.stringify({ error: "Missing URL parameter" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const parsed = parseURL(targetUrl);
  if (!parsed?.hostname || !isValidHostName(parsed.hostname)) {
    return new Response(JSON.stringify({ error: "Invalid or blocked URL" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    // Forward the request using native fetch
    const response = await fetch(parsed.href, {
      method: req.method,
      headers: {
        ...Object.fromEntries(req.headers),
        host: parsed.hostname,
      },
      body: req.method !== "GET" && req.method !== "HEAD" ? req.body : undefined,
      redirect: "follow",
    });

    // Return proxied response
    const headers = new Headers();
    response.headers.forEach((value, key) => {
      if (!["content-encoding", "content-length", "transfer-encoding"].includes(key.toLowerCase())) {
        headers.set(key, value);
      }
    });
    headers.set("Access-Control-Allow-Origin", "*");

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  } catch (err) {
    console.error("Proxy error:", err);
    return new Response(JSON.stringify({ error: "Proxy failed" }), {
      status: 502,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }
}
