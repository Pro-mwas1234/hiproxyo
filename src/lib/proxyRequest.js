export default async function proxyRequest(req, res, parsed, options, proxyServer) {
  const target = `${parsed.protocol}//${parsed.host}`;

  // Remove headers as configured
  if (options.removeHeaders) {
    options.removeHeaders.forEach((header) => {
      delete req.headers[header.toLowerCase()];
    });
  }

  proxyServer.web(req, res, {
    target,
    changeOrigin: true,
    headers: {
      host: parsed.hostname,
    },
  });
}
