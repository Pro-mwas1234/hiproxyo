// ✅ api/proxy.js
import parseURL from "../src/lib/parseURL.js";
import { isValidHostName } from "../src/lib/isValidHostName.js";

export const config = {
  runtime: "nodejs",
};

export default async function handler(req, res) {
  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, Origin");

  // Handle preflight
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  // Get target URL from query param
  const targetUrl = req.query?.url;

  if (!targetUrl) {
    res.status(400).json({ error: "Missing 'url' query parameter. Example: /api/proxy?url=https://example.com/stream.m3u8" });
    return;
  }

  const parsed = parseURL(targetUrl);
  if (!parsed?.hostname || !isValidHostName(parsed.hostname)) {
    res.status(400).json({ error: "Invalid or blocked URL" });
    return;
  }

  try {
    const response = await fetch(parsed.href, {
      method: req.method,
      headers: {
        ...Object.fromEntries(Object.entries(req.headers).filter(
          ([key]) => !["host", "connection", "content-length"].includes(key.toLowerCase())
        )),
        host: parsed.hostname,
      },
      body: req.method !== "GET" && req.method !== "HEAD" ? req.body : undefined,
      redirect: "follow",
    });

    // Forward headers
    const headers = {};
    for (const [key, value] of response.headers.entries()) {
      if (!["content-encoding", "content-length", "transfer-encoding", "connection"].includes(key.toLowerCase())) {
        headers[key] = value;
      }
    }
    headers["Access-Control-Allow-Origin"] = "*";

    // Handle M3U8 rewriting
    if (parsed.pathname.toLowerCase().endsWith(".m3u8")) {
      const text = await response.text();
      const baseUrl = `${parsed.protocol}//${parsed.host}`;
      const rewritten = text.replace(
        /(URI=|)(["']?)(https?:\/\/|)([^"'\s]+)(["']?)/g,
        (match, prefix, q1, protocol, path, q2) => {
          const fullPath = protocol ? protocol + path : new URL(path, baseUrl).href;
          return `${prefix}${q1}/api/proxy?url=${encodeURIComponent(fullPath)}${q2}`;
        }
      );
      res.setHeader("Content-Type", "application/vnd.apple.mpegurl");
      res.status(response.status).send(rewritten);
      return;
    }

    // Stream other content
    res.setHeader("Content-Type", response.headers.get("content-type") || "application/octet-stream");
    
    if (response.body) {
      for await (const chunk of response.body) {
        res.write(chunk);
      }
    }
    res.status(response.status).end();
  } catch (err) {
    console.error("Proxy error:", err);
    res.status(502).json({ error: "Proxy failed", details: err.message });
  }
}
