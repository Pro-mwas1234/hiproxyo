// ✅ src/lib/parseURL.js - WHATWG URL API (no deprecation warning)

export default function parseURL(req_url) {
  const match = req_url.match(
    /^(?:(https?:)?\/\/)?(([^\/?]+?)(?::(\d{0,5})(?=[\/?]|$))?)([\/?][\S\s]*|$)/i
  );
  if (!match) {
    return null;
  }
  if (!match[1]) {
    if (/^https?:/i.test(req_url)) {
      return null;
    }
    if (req_url.lastIndexOf("//", 0) === -1) {
      req_url = "//" + req_url;
    }
    req_url = (match[4] === "443" ? "https:" : "http:") + req_url;
  }

  try {
    const urlObj = new URL(req_url);

    // Return shape compatible with legacy url.parse() output
    // so callers (createServer.js, proxyRequest.js, etc.) don't break
    return {
      href: urlObj.href,
      protocol: urlObj.protocol,
      slashes: true, // http/https always have //
      auth: urlObj.username || urlObj.password
        ? `${urlObj.username}${urlObj.password ? `:${urlObj.password}` : ""}`
        : null,
      username: urlObj.username,
      password: urlObj.password,
      host: urlObj.host,
      hostname: urlObj.hostname,
      port: urlObj.port,
      pathname: urlObj.pathname,
      search: urlObj.search,
      query: urlObj.search ? urlObj.search.slice(1) : null, // legacy: string without '?'
      hash: urlObj.hash,
      path: urlObj.pathname + urlObj.search, // convenience property
    };
  } catch (e) {
    // Invalid URL
    return null;
  }
}
