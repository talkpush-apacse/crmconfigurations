/**
 * Where should Google sign-in start?
 *
 * Google is told to send people back to ONE fixed address (GOOGLE_REDIRECT_URI), and the "state" check that protects the
 * sign-in lives in a cookie. A cookie only travels to the address that set it, so sign-in has to START on that same
 * address. Otherwise the person comes back to a place that never saw them leave and is told "Google sign-in expired",
 * and trying again never helps.
 *
 * - The site has more than one address (for example crmconfig.talkpush.com and crm.se-talkpush.com): move the person to
 *   the address Google will return to, then start there.
 * - A preview or local copy cannot do Google sign-in at all (Google would return to the live site): say so plainly.
 *
 * The address we move people to always comes from the server's own setting, never from the request, so it cannot be used
 * to send anyone elsewhere.
 */

export type GoogleSignInPlan =
  | { action: "continue" }
  | { action: "move"; url: string }
  | { action: "unavailable" };

function isPreviewOrLocalHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  return h.endsWith(".vercel.app") || h === "localhost" || h === "127.0.0.1" || h === "[::1]" || h.endsWith(".localhost");
}

export function planGoogleSignIn(requestUrl: string, configuredRedirectUri: string | undefined): GoogleSignInPlan {
  if (!configuredRedirectUri) return { action: "continue" };

  let here: URL;
  let target: URL;
  try {
    here = new URL(requestUrl);
    target = new URL(configuredRedirectUri);
  } catch {
    return { action: "continue" };
  }

  if (here.host.toLowerCase() === target.host.toLowerCase()) return { action: "continue" };
  if (isPreviewOrLocalHost(here.hostname)) return { action: "unavailable" };

  return { action: "move", url: new URL("/api/auth/google", target.origin).toString() };
}

/** The address people should open to sign in: where Google sign-in returns to, else the address they are on. */
export function signInOrigin(configuredRedirectUri: string | undefined, fallbackOrigin: string): string {
  if (configuredRedirectUri) {
    try {
      return new URL(configuredRedirectUri).origin;
    } catch {
      // fall through
    }
  }
  return fallbackOrigin;
}
