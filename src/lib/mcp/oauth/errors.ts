/** Errors named by the OAuth standards, so Claude's connector can react to them correctly. */

export type OAuthErrorCode =
  | "invalid_request"
  | "invalid_client"
  | "invalid_grant"
  | "invalid_scope"
  | "unsupported_grant_type"
  | "invalid_redirect_uri"
  | "invalid_client_metadata"
  | "access_denied"
  | "temporarily_unavailable"
  | "server_error";

export class OAuthError extends Error {
  constructor(
    public readonly code: OAuthErrorCode,
    public readonly description: string,
    public readonly status: number = 400
  ) {
    super(description);
    this.name = "OAuthError";
  }

  toJSON() {
    return { error: this.code, error_description: this.description };
  }
}
