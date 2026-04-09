/**
 * MCP Server Authentication
 * Validates Bearer token against MCP_API_KEY environment variable.
 */

export function validateMcpAuth(request: Request): { valid: boolean; error?: string } {
  const apiKey = process.env.MCP_API_KEY;
  if (!apiKey) {
    return { valid: false, error: "MCP_API_KEY not configured on server" };
  }

  const authHeader = request.headers.get("authorization");
  if (!authHeader) {
    return { valid: false, error: "Missing Authorization header" };
  }

  const [scheme, token] = authHeader.split(" ");
  if (scheme !== "Bearer" || !token) {
    return { valid: false, error: "Invalid Authorization header format. Expected: Bearer <token>" };
  }

  if (token !== apiKey) {
    return { valid: false, error: "Invalid API key" };
  }

  return { valid: true };
}
