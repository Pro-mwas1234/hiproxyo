export function isValidHostName(hostname) {
  if (!hostname || typeof hostname !== "string") {
    return false;
  }

  // Block private/internal IPs
  const blockedPatterns = [
    /^127\./,
    /^10\./,
    /^172\.(1[6-9]|2[0-9]|3[01])\./,
    /^192\.168\./,
    /^0\.0\.0\.0/,
    /^localhost$/i,
    /\.local$/i,
    /\.internal$/i,
  ];

  for (const pattern of blockedPatterns) {
    if (pattern.test(hostname)) {
      return false;
    }
  }

  // Basic hostname validation
  const hostnameRegex = /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;
  return hostnameRegex.test(hostname);
}
