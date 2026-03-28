import httpProxy from "http-proxy";
import parseURL from "../src/lib/parseURL.js";
import { isValidHostName } from "../src/lib/isValidHostName.js";

export const config = {
  runtime: "nodejs",
};

const proxy = httpProxy.createProxyServer({
  xfwd: false,
  secure: process.env.NODE_TLS_REJECT_UNAUTHORIZED !== "0",
});

export default async function handler(req, res) {
  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, DELETE, OPTIONS"
  );
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, Origin"
  );

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  // Get target URL from query or body
  const targetUrl = req.query?.url || req.body?.url;

  if (!targetUrl) {
    res.status(400).json({ error: "Missing URL parameter" });
    return;
  }

  const parsed = parseURL(targetUrl);

  if (!parsed || !parsed.hostname) {
    res.status(400).json({ error: "Invalid URL" });
    return;
  }

  if (!isValidHostName(parsed.hostname)) {
    res.status(403).json({ error: "Hostname not allowed" });
    return;
  }

  // Proxy the request
  proxy.web(req, res, {
    target: `${parsed.protocol}//${parsed.host}`,
    changeOrigin: true,
  });
}
