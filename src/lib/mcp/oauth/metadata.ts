/** The "how to sign in" documents Claude reads to set up a connection (RFC 8414 and RFC 9728). */

import { GRANT_TYPES, OAUTH_SCOPE } from "./constants";

export function authorizationServerMetadata(origin: string) {
  return {
    issuer: origin,
    authorization_endpoint: `${origin}/oauth/authorize`,
    token_endpoint: `${origin}/api/oauth/token`,
    registration_endpoint: `${origin}/api/oauth/register`,
    revocation_endpoint: `${origin}/api/oauth/revoke`,
    scopes_supported: [OAUTH_SCOPE],
    response_types_supported: ["code"],
    grant_types_supported: [...GRANT_TYPES],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none"],
  };
}

/** `resourcePath` is the connector's own path, for example "/api/mcp/tracker". */
export function protectedResourceMetadata(origin: string, resourcePath: string) {
  return {
    resource: `${origin}${resourcePath}`,
    authorization_servers: [origin],
    scopes_supported: [OAUTH_SCOPE],
    bearer_methods_supported: ["header"],
  };
}

/** The header that tells Claude where to start signing in when a request has no valid credentials. */
export function wwwAuthenticate(origin: string, resourcePath: string): string {
  return `Bearer resource_metadata="${origin}/.well-known/oauth-protected-resource${resourcePath}"`;
}
