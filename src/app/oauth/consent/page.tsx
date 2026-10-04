import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Check, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { makeConsentToken } from "@/lib/mcp/oauth/consent-token";
import { OAuthError } from "@/lib/mcp/oauth/errors";
import { redirectHost } from "@/lib/mcp/oauth/redirect";
import { validateAuthorizeRequest } from "@/lib/mcp/oauth/service";
import { adminFromSessionCookie } from "@/lib/mcp/oauth/session";

export const dynamic = "force-dynamic";
export const metadata = { title: "Connect an app", robots: { index: false, follow: false } };

const FIELDS = ["client_id", "redirect_uri", "code_challenge", "code_challenge_method", "state", "scope", "response_type"] as const;

export default async function ConsentPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const raw = await searchParams;
  const q: Record<string, string> = {};
  for (const name of FIELDS) {
    const value = raw[name];
    if (typeof value === "string") q[name] = value;
  }

  const admin = await adminFromSessionCookie((await cookies()).get("admin_token")?.value);
  if (!admin) redirect(`/oauth/authorize?${new URLSearchParams(q).toString()}`);

  let appName = "";
  let problem: string | null = null;
  try {
    const client = await validateAuthorizeRequest({
      clientId: q.client_id ?? "",
      redirectUri: q.redirect_uri ?? "",
      codeChallenge: q.code_challenge ?? "",
      codeChallengeMethod: q.code_challenge_method ?? "",
      scope: q.scope,
    });
    appName = client.clientName;
  } catch (err) {
    problem = err instanceof OAuthError ? err.description : "Something went wrong on our side.";
  }

  const secret = process.env.ADMIN_SECRET;
  if (!problem && !secret) problem = "Something went wrong on our side.";

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Talkpush Implementation Hub</p>
          <CardTitle className="text-xl">{problem ? "This connection cannot be made" : "Connect an app?"}</CardTitle>
        </CardHeader>

        {problem ? (
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>{problem}</p>
            <p>Go back to the app you were connecting and try again.</p>
          </CardContent>
        ) : (
          <form method="post" action="/oauth/decision">
            <CardContent className="space-y-4 text-sm">
              <p>
                An app calling itself <strong className="font-semibold">“{appName}”</strong> wants to connect. When you finish, you
                will be sent back to <strong className="font-semibold">{redirectHost(q.redirect_uri ?? "")}</strong>.
              </p>
              <p>
                You are signed in as <strong className="font-semibold">{admin.email}</strong>. The app will act as you.
              </p>
              <div>
                <p className="font-medium">It will be able to:</p>
                <ul className="mt-2 space-y-2 text-muted-foreground">
                  <li className="flex gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                    Read and change CRM Config Checklists, including removing message templates
                  </li>
                  <li className="flex gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                    Read and change Project Tracker projects, items and metrics (it cannot delete tracker data)
                  </li>
                  <li className="flex gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                    Read and change Workflow Builder maps, read client comments, and create or turn off client review links (it cannot
                    delete a whole map, but it can remove steps and pages)
                  </li>
                </ul>
              </div>
              <p className="flex gap-2 text-muted-foreground">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                Only allow apps you started connecting yourself. You can disconnect it later from Connected apps in the admin area.
              </p>

              {FIELDS.filter((name) => name !== "response_type").map((name) => (
                <input key={name} type="hidden" name={name} value={q[name] ?? ""} />
              ))}
              <input
                type="hidden"
                name="consent"
                value={makeConsentToken(secret as string, {
                  userId: admin.id,
                  clientId: q.client_id ?? "",
                  redirectUri: q.redirect_uri ?? "",
                  codeChallenge: q.code_challenge ?? "",
                  state: q.state ?? "",
                  scope: q.scope ?? "",
                })}
              />
            </CardContent>
            <CardFooter className="gap-2">
              <Button type="submit" name="decision" value="allow" className="h-11 min-w-24">
                Allow
              </Button>
              <Button type="submit" name="decision" value="deny" variant="outline" className="h-11 min-w-24">
                Cancel
              </Button>
            </CardFooter>
          </form>
        )}
      </Card>
    </main>
  );
}
