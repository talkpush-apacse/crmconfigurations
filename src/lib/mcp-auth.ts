/**
 * MCP Server Authentication
 * Validates API key via Bearer token header OR ?api_key= query parameter.
 * Claude AI's custom connector passes the key as a query parameter.
 */

export function validateMcpAuth(request: Request): { valid: boolean; error?: string } {
  const apiKey = process.env.MCP_API_KEY;
  if (!apiKey) {
    return { valid: false, error: "MCP_API_KEY not configured on server" };
  }

  // Check Authorization header first
  const authHeader = request.headers.get("authorization");
  if (authHeader) {
    const [scheme, token] = authHeader.split(" ");
    if (scheme === "Bearer" && token === apiKey) {
      return { valid: true };
    }
  }

  // Fall back to query parameter (Claude AI custom connector format)
  const url = new URL(request.url);
  const queryKey = url.searchParams.get("api_key");
  if (queryKey === apiKey) {
    return { valid: true };
  }

  return { valid: false, error: "Invalid or missing API key" };
}
