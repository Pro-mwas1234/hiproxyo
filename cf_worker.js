export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === "/m3u8-proxy") {
      return handleM3U8Proxy(request, env);
    } else if (url.pathname === "/ts-proxy") {
      return handleTsProxy(request, env);
    }

    return new Response("Not Found", { status: 404 });
  },
};

const isOriginAllowed = (origin, env) => {
  const allowedOrigins = (env.ALLOWED_ORIGINS || "*").split(",").map(o => o.trim());
  if (allowedOrigins.includes("*")) return true;
  return allowedOrigins.includes(origin);
};

async function handleM3U8Proxy(request, env) {
  const { searchParams } = new URL(request.url);
  const targetUrl = searchParams.get("url");
  const headers = JSON.parse(searchParams.get("headers") || "{}");
  const origin = request.headers.get("Origin") || "";

  const defaultHeaders = {
    "Referer": env.DEFAULT_REFERER || "https://megacloud.blog",
    "Origin": env.DEFAULT_ORIGIN || "https://hianime.to",
    "User-Agent": request.headers.get("User-Agent") || "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
  };

  const finalHeaders = {
    ...defaultHeaders,
    ...headers
  };

  if (!isOriginAllowed(origin, env)) {
    return new Response(`The origin "${origin}" is not allowed.`, {
      status: 403,
      headers: { "Access-Control-Allow-Origin": "*" }
    });
  }

  if (!targetUrl) {
    return new Response("URL is required", { status: 400 });
  }

  try {
    const response = await fetch(targetUrl, { headers: finalHeaders });
    if (!response.ok) {
      return new Response("Failed to fetch the m3u8 file", {
        status: response.status,
        headers: { "Access-Control-Allow-Origin": "*" }
      });
    }

    let m3u8 = await response.text();
    const lines = m3u8.split("\n");
    const newLines = [];

    const urlObj = new URL(request.url);
    const workerUrl = `${urlObj.protocol}//${urlObj.host}`;

    for (let line of lines) {
      line = line.trim();
      if (!line) continue;

      if (line.startsWith("#")) {
        if (line.startsWith("#EXT-X-KEY:") || line.startsWith("#EXT-X-MEDIA:")) {
          const uriMatch = line.match(/URI=["']?([^"']+)["']?/);
          if (uriMatch) {
            const originalUri = uriMatch[1];
            const absoluteUri = new URL(originalUri, targetUrl).href;
            const proxyPath = line.includes("TYPE=AUDIO") || line.includes("TYPE=SUBTITLES") ? "/m3u8-proxy" : "/ts-proxy";
            const newUrl = `${workerUrl}${proxyPath}?url=${encodeURIComponent(absoluteUri)}&headers=${encodeURIComponent(JSON.stringify(finalHeaders))}`;
            newLines.push(line.replace(originalUri, newUrl));
          } else {
            newLines.push(line);
          }
        } else {
          newLines.push(line);
        }
      } else {
        const absoluteUri = new URL(line, targetUrl).href;
        newLines.push(`${workerUrl}/ts-proxy?url=${encodeURIComponent(absoluteUri)}&headers=${encodeURIComponent(JSON.stringify(finalHeaders))}`);
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
  } catch (error) {
    return new Response(error.message, { status: 500, headers: { "Access-Control-Allow-Origin": "*" } });
  }
}

async function handleTsProxy(request, env) {
  const { searchParams } = new URL(request.url);
  const targetUrl = searchParams.get("url");
  const headers = JSON.parse(searchParams.get("headers") || "{}");
  const origin = request.headers.get("Origin") || "";

  if (!isOriginAllowed(origin, env)) {
    return new Response(`The origin "${origin}" is not allowed.`, {
      status: 403,
      headers: { "Access-Control-Allow-Origin": "*" }
    });
  }

  if (!targetUrl) {
    return new Response("URL is required", { status: 400 });
  }

  const forwardHeaders = new Headers({
    "User-Agent": request.headers.get("User-Agent") || "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    ...headers
  });

  // Forward Range header if present
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
      "Cache-Control": "public, max-age=3600"
    });

    // Forward essential response headers
    const headersToForward = [
      "Content-Type",
      "Content-Length",
      "Content-Range",
      "Accept-Ranges",
    ];

    headersToForward.forEach(header => {
      if (response.headers.has(header)) {
        responseHeaders.set(header, response.headers.get(header));
      }
    });

    // Ensure a representative content-type if missing
    if (!responseHeaders.has("Content-Type")) {
      responseHeaders.set("Content-Type", "video/mp2t");
    }

    return new Response(response.body, {
      status: response.status,
      headers: responseHeaders,
    });
  } catch (error) {
    return new Response(error.message, { status: 500, headers: { "Access-Control-Allow-Origin": "*" } });
  }
}
