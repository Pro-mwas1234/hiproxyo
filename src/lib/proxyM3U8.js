import axios from "axios";
import parseURL from "./parseURL.js";

export default async function proxyM3U8(req, res, parsed, options, proxyServer) {
  try {
    const target = `${parsed.protocol}//${parsed.host}${parsed.pathname}${parsed.search || ""}`;

    const response = await axios.get(target, {
      responseType: "text",
      headers: {
        "User-Agent": req.headers["user-agent"] || "Mozilla/5.0",
      },
      maxRedirects: 5,
    });

    let content = response.data;

    // Rewrite relative URLs to absolute through proxy
    const baseUrl = `${parsed.protocol}//${parsed.host}`;
    const proxyPrefix = "/proxy/";

    content = content.replace(
      /(URI=|)(["']?)(https?:\/\/|)([^"'\s]+)(["']?)/g,
      (match, prefix, q1, protocol, path, q2) => {
        if (protocol) {
          return `${prefix}${q1}${proxyPrefix}${encodeURIComponent(protocol + path)}${q2}`;
        } else {
          const absolutePath = path.startsWith("/") ? path : `${parsed.pathname.substring(0, parsed.pathname.lastIndexOf("/") + 1)}${path}`;
          return `${prefix}${q1}${proxyPrefix}${encodeURIComponent(baseUrl + absolutePath)}${q2}`;
        }
      }
    );

    res.writeHead(200, {
      "Content-Type": "application/vnd.apple.mpegurl",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "no-cache",
    });
    res.end(content);
  } catch (err) {
    console.error("M3U8 Proxy Error:", err.message);
    res.writeHead(500, { "Content-Type": "text/plain" });
    res.end("Error fetching M3U8 playlist");
  }
}
