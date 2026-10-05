/**
 * Claude connector sign-in: registering apps, one-time codes, tokens, and revoking.
 *
 * Everything that decides "is this person allowed in" lives here, so the pages and routes stay thin and
 * every rule can be tested in one place. Codes and tokens are random and stored only as SHA-256 hashes.
 */

import { z } from "zod";
import { prisma } from "@/lib/db";
import { normaliseRole, type Role } from "@/lib/roles";
import {
  ACCESS_TOKEN_TTL_SECONDS,
  AUTH_CODE_TTL_SECONDS,
  GRANT_TYPES,
  LAST_USED_WRITE_INTERVAL_SECONDS,
  MAX_REDIRECT_URIS,
  MAX_REGISTERED_CLIENTS,
  OAUTH_SCOPE,
  REFRESH_TOKEN_TTL_SECONDS,
  UNUSED_CLIENT_MAX_AGE_DAYS,
} from "./constants";
import { hashSecret, isValidCodeChallenge, looksLikeAccessToken, newSecret, verifyPkce } from "./crypto";
import { OAuthError } from "./errors";
import { isAllowedRedirectUri, redirectMatchesRegistered } from "./redirect";

const seconds = (n: number) => n * 1000;

// ---------------------------------------------------------------------------
// registering an app (RFC 7591)
// ---------------------------------------------------------------------------

const registrationSchema = z
  .object({
    client_name: z.string().max(200).optional(),
    redirect_uris: z.array(z.string()).min(1).max(MAX_REDIRECT_URIS),
    token_endpoint_auth_method: z.literal("none").optional(),
    grant_types: z.array(z.enum(GRANT_TYPES)).optional(),
    response_types: z.array(z.literal("code")).optional(),
    scope: z.string().optional(),
  })
  .loose();

/** Names are shown on the Allow page, so keep them short and plain. */
export function cleanClientName(raw: string | undefined): string {
  const cleaned = (raw ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, 100);
  return cleaned || "Unnamed app";
}

export interface RegisteredClient {
  client_id: string;
  client_id_issued_at: number;
  client_name: string;
  redirect_uris: string[];
  token_endpoint_auth_method: "none";
  grant_types: string[];
  response_types: string[];
  scope: string;
}

export async function registerClient(input: unknown, now: Date = new Date()): Promise<RegisteredClient> {
  const parsed = registrationSchema.safeParse(input);
  if (!parsed.success) {
    throw new OAuthError("invalid_client_metadata", "Registration needs redirect_uris and only supports public clients with PKCE.");
  }
  const { redirect_uris } = parsed.data;
  for (const uri of redirect_uris) {
    if (!isAllowedRedirectUri(uri)) {
      throw new OAuthError("invalid_redirect_uri", "That redirect address is not allowed for this server.");
    }
  }
  if (parsed.data.scope && parsed.data.scope.split(/\s+/).some((s) => s && s !== OAUTH_SCOPE)) {
    throw new OAuthError("invalid_client_metadata", `Only the "${OAUTH_SCOPE}" scope is supported.`);
  }

  // Keep the table bounded: drop apps that never got anyone connected, then refuse if still too many.
  const cutoff = new Date(now.getTime() - UNUSED_CLIENT_MAX_AGE_DAYS * 24 * 60 * 60 * 1000);
  await prisma.mcpOAuthClient.deleteMany({ where: { createdAt: { lt: cutoff }, tokens: { none: {} } } });
  if ((await prisma.mcpOAuthClient.count()) >= MAX_REGISTERED_CLIENTS) {
    throw new OAuthError("temporarily_unavailable", "Too many apps are registered. Try again later.", 503);
  }

  const clientName = cleanClientName(parsed.data.client_name);
  const row = await prisma.mcpOAuthClient.create({
    data: { clientName, redirectUris: redirect_uris, createdAt: now },
  });
  return {
    client_id: row.id,
    client_id_issued_at: Math.floor(now.getTime() / 1000),
    client_name: clientName,
    redirect_uris,
    token_endpoint_auth_method: "none",
    grant_types: [...GRANT_TYPES],
    response_types: ["code"],
    scope: OAUTH_SCOPE,
  };
}

export interface ClientInfo {
  id: string;
  clientName: string;
  redirectUris: string[];
}

export async function getClient(clientId: string): Promise<ClientInfo | null> {
  if (!clientId || clientId.length > 100) return null;
  const row = await prisma.mcpOAuthClient.findUnique({ where: { id: clientId } });
  if (!row) return null;
  const uris = z.array(z.string()).safeParse(row.redirectUris);
  return { id: row.id, clientName: row.clientName, redirectUris: uris.success ? uris.data : [] };
}

// ---------------------------------------------------------------------------
// the one-time code, created when a signed-in person clicks Allow
// ---------------------------------------------------------------------------

export interface AuthorizeRequest {
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  codeChallengeMethod: string;
  scope?: string;
}

/**
 * Checks an authorize request from an app. Used before showing the Allow page and again when "Allow" is
 * clicked, so a tampered form cannot skip a rule. Returns the app so the page can name it.
 */
export async function validateAuthorizeRequest(req: AuthorizeRequest): Promise<ClientInfo> {
  const client = await getClient(req.clientId);
  if (!client) throw new OAuthError("invalid_client", "Unknown app. It needs to register first.");
  if (!redirectMatchesRegistered(req.redirectUri, client.redirectUris) || !isAllowedRedirectUri(req.redirectUri)) {
    throw new OAuthError("invalid_redirect_uri", "That redirect address is not registered for this app.");
  }
  if (req.codeChallengeMethod !== "S256") {
    throw new OAuthError("invalid_request", "PKCE with the S256 method is required.");
  }
  if (!isValidCodeChallenge(req.codeChallenge)) {
    throw new OAuthError("invalid_request", "The PKCE code challenge is not valid.");
  }
  if (req.scope && req.scope.split(/\s+/).some((s) => s && s !== OAUTH_SCOPE)) {
    throw new OAuthError("invalid_scope", `Only the "${OAUTH_SCOPE}" scope is supported.`);
  }
  return client;
}

/** Returns the raw code to send back to the app. Only its hash is stored. */
export async function createAuthCode(
  req: AuthorizeRequest & { adminUserId: string },
  now: Date = new Date()
): Promise<string> {
  await validateAuthorizeRequest(req);

  // Tidy up codes that expired more than an hour ago.
  await prisma.mcpAuthCode.deleteMany({ where: { expiresAt: { lt: new Date(now.getTime() - seconds(3600)) } } });

  const code = newSecret("authCode");
  await prisma.mcpAuthCode.create({
    data: {
      codeHash: hashSecret(code),
      clientId: req.clientId,
      adminUserId: req.adminUserId,
      redirectUri: req.redirectUri,
      codeChallenge: req.codeChallenge,
      scope: OAUTH_SCOPE,
      expiresAt: new Date(now.getTime() + seconds(AUTH_CODE_TTL_SECONDS)),
      createdAt: now,
    },
  });
  return code;
}

// ---------------------------------------------------------------------------
// tokens
// ---------------------------------------------------------------------------

export interface TokenResponse {
  access_token: string;
  token_type: "Bearer";
  expires_in: number;
  refresh_token: string;
  scope: string;
}

function tokenResponse(accessToken: string, refreshToken: string): TokenResponse {
  return {
    access_token: accessToken,
    token_type: "Bearer",
    expires_in: ACCESS_TOKEN_TTL_SECONDS,
    refresh_token: refreshToken,
    scope: OAUTH_SCOPE,
  };
}

export async function exchangeAuthCode(
  input: { code: string; clientId: string; redirectUri: string; codeVerifier: string },
  now: Date = new Date()
): Promise<TokenResponse> {
  const invalid = () => new OAuthError("invalid_grant", "That code is invalid, expired or already used.");

  const row = await prisma.mcpAuthCode.findUnique({ where: { codeHash: hashSecret(input.code) } });
  if (!row || row.usedAt || row.expiresAt <= now) throw invalid();
  if (row.clientId !== input.clientId || row.redirectUri !== input.redirectUri) throw invalid();
  if (!verifyPkce(input.codeVerifier, row.codeChallenge)) throw invalid();

  const accessToken = newSecret("accessToken");
  const refreshToken = newSecret("refreshToken");

  await prisma.$transaction(async (tx) => {
    // Claim the code. If two requests race with the same code, only one gets count 1.
    const claimed = await tx.mcpAuthCode.updateMany({ where: { id: row.id, usedAt: null }, data: { usedAt: now } });
    if (claimed.count !== 1) throw invalid();
    await tx.mcpToken.create({
      data: {
        clientId: row.clientId,
        adminUserId: row.adminUserId,
        accessTokenHash: hashSecret(accessToken),
        refreshTokenHash: hashSecret(refreshToken),
        accessExpiresAt: new Date(now.getTime() + seconds(ACCESS_TOKEN_TTL_SECONDS)),
        refreshExpiresAt: new Date(now.getTime() + seconds(REFRESH_TOKEN_TTL_SECONDS)),
        scope: row.scope,
        createdAt: now,
      },
    });
    await tx.mcpOAuthClient.update({ where: { id: row.clientId }, data: { lastUsedAt: now } });
  });

  return tokenResponse(accessToken, refreshToken);
}

/** Swap a refresh token for a new pair. The old refresh token stops working, so a copied one is useless. */
export async function refreshTokens(
  input: { refreshToken: string; clientId: string },
  now: Date = new Date()
): Promise<TokenResponse> {
  const invalid = () => new OAuthError("invalid_grant", "That refresh token is invalid, expired or revoked.");

  const oldHash = hashSecret(input.refreshToken);
  const row = await prisma.mcpToken.findUnique({ where: { refreshTokenHash: oldHash } });
  if (!row || row.revokedAt || row.refreshExpiresAt <= now || row.clientId !== input.clientId) throw invalid();

  const accessToken = newSecret("accessToken");
  const refreshToken = newSecret("refreshToken");
  const rotated = await prisma.mcpToken.updateMany({
    where: { id: row.id, refreshTokenHash: oldHash, revokedAt: null },
    data: {
      accessTokenHash: hashSecret(accessToken),
      refreshTokenHash: hashSecret(refreshToken),
      accessExpiresAt: new Date(now.getTime() + seconds(ACCESS_TOKEN_TTL_SECONDS)),
      refreshExpiresAt: new Date(now.getTime() + seconds(REFRESH_TOKEN_TTL_SECONDS)),
      lastUsedAt: now,
    },
  });
  if (rotated.count !== 1) throw invalid();
  return tokenResponse(accessToken, refreshToken);
}

export interface ConnectionAuth {
  tokenId: string;
  adminUserId: string;
  email: string;
  clientName: string;
  /** The person's role right now (read from the database on every call, so a change takes effect at once). */
  role: Role;
}

/** Who is calling the connector with this access token? null if the token is unknown, expired or revoked. */
export async function authenticateAccessToken(token: string, now: Date = new Date()): Promise<ConnectionAuth | null> {
  if (!looksLikeAccessToken(token) || token.length > 200) return null;
  const row = await prisma.mcpToken.findUnique({
    where: { accessTokenHash: hashSecret(token) },
    include: { adminUser: { select: { email: true, role: true } }, client: { select: { clientName: true } } },
  });
  if (!row || row.revokedAt || row.accessExpiresAt <= now) return null;

  const stale = !row.lastUsedAt || now.getTime() - row.lastUsedAt.getTime() > seconds(LAST_USED_WRITE_INTERVAL_SECONDS);
  if (stale) await prisma.mcpToken.update({ where: { id: row.id }, data: { lastUsedAt: now } });

  return {
    tokenId: row.id,
    adminUserId: row.adminUserId,
    email: row.adminUser.email,
    clientName: row.client.clientName,
    role: normaliseRole(row.adminUser.role),
  };
}

// ---------------------------------------------------------------------------
// revoking, and the "Connected apps" list
// ---------------------------------------------------------------------------

/** RFC 7009: accepts either token of a connection. Always succeeds, so it cannot be used to probe for tokens. */
export async function revokeByToken(token: string, now: Date = new Date()): Promise<void> {
  const hash = hashSecret(token);
  await prisma.mcpToken.updateMany({
    where: { revokedAt: null, OR: [{ accessTokenHash: hash }, { refreshTokenHash: hash }] },
    data: { revokedAt: now },
  });
}

export async function revokeConnection(tokenId: string, now: Date = new Date()): Promise<boolean> {
  const result = await prisma.mcpToken.updateMany({ where: { id: tokenId, revokedAt: null }, data: { revokedAt: now } });
  return result.count === 1;
}

export interface Connection {
  id: string;
  email: string;
  appName: string;
  connectedAt: Date;
  lastUsedAt: Date | null;
}

/** Live connections: not revoked, and renewable. */
export async function listConnections(now: Date = new Date()): Promise<Connection[]> {
  const rows = await prisma.mcpToken.findMany({
    where: { revokedAt: null, refreshExpiresAt: { gt: now } },
    orderBy: { createdAt: "desc" },
    include: { adminUser: { select: { email: true } }, client: { select: { clientName: true } } },
  });
  return rows.map((r) => ({
    id: r.id,
    email: r.adminUser.email,
    appName: r.client.clientName,
    connectedAt: r.createdAt,
    lastUsedAt: r.lastUsedAt,
  }));
}
