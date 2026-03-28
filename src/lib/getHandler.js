import proxyRequest from "./proxyRequest.js";
import proxyM3U8 from "./proxyM3U8.js";
import proxyTS from "./proxyTS.js";
import parseURL from "./parseURL.js";
import { isValidHostName } from "./isValidHostName.js";

export default function getHandler(options, proxyServer) {
  return async function (req, res) {
    const url = req.url;

    // Extract target URL from query or path
    let targetUrl = req.query?.url || req.body?.url;

    if (!targetUrl) {
      // Try to extract from path: /proxy/https://example.com/...
      const pathMatch = url.match(/^\/proxy\/(.+)$/);
      if (pathMatch) {
        targetUrl = decodeURIComponent(pathMatch[1]);
      }
    }

    if (!targetUrl) {
      res.writeHead(400, { "Content-Type": "text/plain" });
      res.end("Missing URL parameter");
      return;
    }

    const parsed = parseURL(targetUrl);

    if (!parsed || !parsed.hostname) {
      res.writeHead(400, { "Content-Type": "text/plain" });
      res.end("Invalid URL");
      return;
    }

    if (!isValidHostName(parsed.hostname)) {
      res.writeHead(403, { "Content-Type": "text/plain" });
      res.end("Hostname not allowed");
      return;
    }

    // Route based on content type
    const pathname = parsed.pathname.toLowerCase();

    if (pathname.endsWith(".m3u8") || pathname.endsWith(".m3u")) {
      await proxyM3U8(req, res, parsed, options, proxyServer);
    } else if (pathname.endsWith(".ts")) {
      await proxyTS(req, res, parsed, options, proxyServer);
    } else {
      await proxyRequest(req, res, parsed, options, proxyServer);
    }
  };
}
