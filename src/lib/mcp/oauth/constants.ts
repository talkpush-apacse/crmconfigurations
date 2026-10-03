/** Tunable rules for the Claude connector sign-in. One place, so a change here is a one-line review. */

export const OAUTH_SCOPE = "mcp";

/** Claude renews quietly, so access tokens are short-lived. */
export const ACCESS_TOKEN_TTL_SECONDS = 60 * 60;
/** A connection lapses after this long unused. Each renewal pushes it out again (sliding). */
export const REFRESH_TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60;
/** The one-time code handed back after "Allow". */
export const AUTH_CODE_TTL_SECONDS = 60;

export const MAX_REDIRECT_URIS = 5;
/** Anyone may register an app (that is how the standard works), so keep the table bounded. */
export const MAX_REGISTERED_CLIENTS = 500;
export const UNUSED_CLIENT_MAX_AGE_DAYS = 7;
/** Only write "last used" this often, so a busy connection does not write on every call. */
export const LAST_USED_WRITE_INTERVAL_SECONDS = 60;

export const SECRET_PREFIX = {
  accessToken: "mcp_at_",
  refreshToken: "mcp_rt_",
  authCode: "mcp_ac_",
} as const;

export const GRANT_TYPES = ["authorization_code", "refresh_token"] as const;
