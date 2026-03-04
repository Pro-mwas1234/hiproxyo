export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Handle CORS preflight requests
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "*",
          "Access-Control-Max-Age": "86400",
        },
      });
    }

    if (url.pathname === "/m3u8-proxy") {
      return handleM3U8Proxy(request, env);
    } else if (url.pathname === "/ts-proxy") {
      return handleTsProxy(request, env);
    }

    return new Response("Not Found", { status: 404 });
  },
};

const isOriginAllowed = (origin, env) => {
  if (!origin) return true;
  const allowedOrigins = (env.ALLOWED_ORIGINS || "*").split(",").map(o => o.trim());
  return allowedOrigins.includes("*") || allowedOrigins.includes(origin);
};

async function handleM3U8Proxy(request, env) {
  const { searchParams } = new URL(request.url);
  const targetUrl = searchParams.get("url");
  const headersParam = searchParams.get("headers");
  const headers = JSON.parse(headersParam || "{}");
  const origin = request.headers.get("Origin") || "";

  if (!isOriginAllowed(origin, env)) {
    return new Response(`Origin "${origin}" not allowed`, {
      status: 403,
      headers: { "Access-Control-Allow-Origin": "*" }
    });
  }

  if (!targetUrl) return new Response("URL required", { status: 400 });

  const finalHeaders = {
    "Referer": env.DEFAULT_REFERER || "https://megacloud.blog",
    "Origin": env.DEFAULT_ORIGIN || "https://hianime.to",
    "User-Agent": request.headers.get("User-Agent") || "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    ...headers
  };

  try {
    const response = await fetch(targetUrl, { headers: finalHeaders });
    if (!response.ok) return new Response("Fetch failed", { status: response.status, headers: { "Access-Control-Allow-Origin": "*" } });

    const m3u8 = await response.text();
    const lines = m3u8.split(/\r?\n/);
    const newLines = [];

    const urlObj = new URL(request.url);
    const workerUrl = `${urlObj.protocol}//${urlObj.host}`;

    const isMaster = m3u8.includes("#EXT-X-STREAM-INF");

    for (let line of lines) {
      const trimmedLine = line.trim();
      if (!trimmedLine) {
        newLines.push(line);
        continue;
      }

      if (trimmedLine.startsWith("#")) {
        if (trimmedLine.startsWith("#EXT-X-KEY:") || trimmedLine.startsWith("#EXT-X-MEDIA:")) {
          const uriMatch = trimmedLine.match(/URI=["']?([^"']+)["']?/);
          if (uriMatch) {
            const originalUri = uriMatch[1];
            const absoluteUri = new URL(originalUri, targetUrl).href;
            const isPlaylist = trimmedLine.includes("TYPE=AUDIO") || trimmedLine.includes("TYPE=SUBTITLES") || originalUri.includes(".m3u8");
            const proxyPath = isPlaylist ? "/m3u8-proxy" : "/ts-proxy";
            const newUrl = `${workerUrl}${proxyPath}?url=${encodeURIComponent(absoluteUri)}${headersParam ? `&headers=${encodeURIComponent(headersParam)}` : ""}`;
            newLines.push(line.replace(originalUri, newUrl));
          } else {
            newLines.push(line);
          }
        } else {
          newLines.push(line);
        }
      } else {
        const absoluteUri = new URL(trimmedLine, targetUrl).href;
        const isM3U8 = trimmedLine.includes(".m3u8") || isMaster;
        const proxyPath = isM3U8 ? "/m3u8-proxy" : "/ts-proxy";
        const newUrl = `${workerUrl}${proxyPath}?url=${encodeURIComponent(absoluteUri)}${headersParam ? `&headers=${encodeURIComponent(headersParam)}` : ""}`;
        newLines.push(newUrl);
      }
    }

    return new Response(newLines.join("\n"), {
      headers: {
        "Content-Type": "application/vnd.apple.mpegurl",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "*",
        "Access-Control-Allow-Methods": "*",
      },
    });
  } catch (e) {
    return new Response(e.message, { status: 500, headers: { "Access-Control-Allow-Origin": "*" } });
  }
}

async function handleTsProxy(request, env) {
  const { searchParams } = new URL(request.url);
  const targetUrl = searchParams.get("url");
  const headers = JSON.parse(searchParams.get("headers") || "{}");
  const origin = request.headers.get("Origin") || "";

  if (!isOriginAllowed(origin, env)) {
    return new Response(`Origin "${origin}" not allowed`, {
      status: 403,
      headers: { "Access-Control-Allow-Origin": "*" }
    });
  }

  if (!targetUrl) return new Response("URL required", { status: 400 });

  const forwardHeaders = new Headers({
    "User-Agent": request.headers.get("User-Agent") || "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Referer": env.DEFAULT_REFERER || "https://megacloud.blog",
    "Origin": env.DEFAULT_ORIGIN || "https://hianime.to",
    ...headers
  });

  if (request.headers.has("Range")) {
    forwardHeaders.set("Range", request.headers.get("Range"));
  }

  try {
    const response = await fetch(targetUrl, {
      method: request.method,
      headers: forwardHeaders,
    });

    const responseHeaders = new Headers({
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "*",
      "Access-Control-Allow-Methods": "*",
    });

    const headersToForward = ["Content-Type", "Content-Length", "Content-Range", "Accept-Ranges", "Cache-Control"];
    headersToForward.forEach(h => {
      if (response.headers.has(h)) responseHeaders.set(h, response.headers.get(h));
    });

    if (!responseHeaders.has("Content-Type")) {
      responseHeaders.set("Content-Type", targetUrl.includes(".m4s") ? "video/iso.segment" : "video/mp2t");
    }

    return new Response(response.body, {
      status: response.status,
      headers: responseHeaders,
    });
  } catch (e) {
    return new Response(e.message, { status: 500, headers: { "Access-Control-Allow-Origin": "*" } });
  }
}
