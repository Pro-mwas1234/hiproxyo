import axios from "axios";

export default async function proxyTS(req, res, parsed, options, proxyServer) {
  try {
    const target = `${parsed.protocol}//${parsed.host}${parsed.pathname}${parsed.search || ""}`;

    const response = await axios.get(target, {
      responseType: "stream",
      headers: {
        "User-Agent": req.headers["user-agent"] || "Mozilla/5.0",
      },
      maxRedirects: 5,
    });

    res.writeHead(200, {
      "Content-Type": "video/MP2T",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=31536000",
    });

    response.data.pipe(res);
  } catch (err) {
    console.error("TS Proxy Error:", err.message);
    res.writeHead(500, { "Content-Type": "text/plain" });
    res.end("Error fetching TS segment");
  }
}
