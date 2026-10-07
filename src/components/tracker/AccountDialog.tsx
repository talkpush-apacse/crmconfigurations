"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { api, errorMessage } from "@/lib/tracker/client-api";
import type { AccountDTO } from "@/lib/tracker/client-types";
import { accountName, customGeo, findGeo, geoOptions, guessCompanyAndGeo } from "@/lib/companies/geo";
import { sameCompanyName } from "@/lib/companies/names";
import { Field, FormError } from "./Field";

interface CompanyOption {
  id: string;
  name: string;
  accounts: { id: string; name: string; geo: string | null; geoCode: string | null }[];
}

/**
 * Create or edit an account: a client company in one geo. Pick (or type) the company and the geo and the account name is
 * built for you ("Concentrix" + Philippines = "Concentrix PH"). There is only ever one of each company, and one account
 * per company per geo. The name can still be changed by hand.
 */
export function AccountDialog({
  open,
  onOpenChange,
  account,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account?: AccountDTO | null;
  onSaved: (account: AccountDTO) => void;
}) {
  const editing = !!account;
  const [company, setCompany] = useState("");
  const [geoText, setGeoText] = useState("");
  const [geoCode, setGeoCode] = useState("");
  const [name, setName] = useState("");
  const [nameTouched, setNameTouched] = useState(false);
  const [placementTouched, setPlacementTouched] = useState(false);
  const [notes, setNotes] = useState("");
  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setCompany(account?.companyName ?? "");
    setGeoText(account?.geo ?? "");
    setGeoCode("");
    setName(account?.name ?? "");
    setNameTouched(false);
    setPlacementTouched(false);
    setNotes(account?.notes ?? "");
    setError("");
    let cancelled = false;
    api<{ companies: CompanyOption[] }>("/api/tracker/companies")
      .then((r) => !cancelled && setCompanies(r.companies))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [open, account]);

  const matched = useMemo(() => companies.find((c) => sameCompanyName(c.name, company)) ?? null, [companies, company]);
  const known = findGeo(geoText);
  const geo = known ?? (geoText.trim() && geoCode.trim() ? customGeo(geoText, geoCode) : null);
  const needsCode = geoText.trim() !== "" && !known;
  const generated = company.trim() && geo ? accountName(matched?.name ?? company, geo) : "";
  const shownName = nameTouched || editing ? name : generated;
  // The company already has an account for this geo (other than the one being edited).
  const clash = matched && geo ? matched.accounts.find((a) => a.geoCode === geo.code && a.id !== account?.id) : undefined;
  // An account with no company yet, whose name ends in a geo: offer to fill the form from it.
  const guess = editing && !account?.companyId ? guessCompanyAndGeo(account.name) : null;
  const options = useMemo(() => geoOptions(), []);
  // A new account needs a company and a geo. An old account with neither can still be edited without them.
  const needsPlacement = !editing || Boolean(account?.companyId) || placementTouched;

  const place = (nextCompany: string, nextGeoText: string, nextGeoCode: string) => {
    setCompany(nextCompany);
    setGeoText(nextGeoText);
    setGeoCode(nextGeoCode);
    setPlacementTouched(true);
    // The name follows the company and geo until someone types a name of their own.
    if (!nameTouched) {
      const k = findGeo(nextGeoText) ?? (nextGeoText.trim() && nextGeoCode.trim() ? customGeo(nextGeoText, nextGeoCode) : null);
      const m = companies.find((c) => sameCompanyName(c.name, nextCompany));
      if (nextCompany.trim() && k) setName(accountName(m?.name ?? nextCompany, k));
    }
  };

  const ready = editing ? shownName.trim() !== "" : Boolean(company.trim() && geo);
  const placementReady = Boolean(company.trim() && geo);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const body: Record<string, unknown> = { notes };
      if (editing) body.name = shownName.trim();
      else if (nameTouched && name.trim()) body.name = name.trim();
      if (placementReady && (!editing || placementTouched || account?.companyId)) {
        body.company = matched?.name ?? company.trim();
        body.geo = geo!.name;
        if (!known) body.geoCode = geo!.code;
      }
      const saved = editing
        ? await api<AccountDTO>(`/api/tracker/accounts/${account!.id}`, { method: "PATCH", body })
        : await api<AccountDTO>("/api/tracker/accounts", { method: "POST", body });
      onSaved(saved);
      onOpenChange(false);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const renamed = editing && account && shownName.trim() !== account.name;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit account" : "New account"}</DialogTitle>
            <DialogDescription>
              An account is a client company in one geo, for example Concentrix PH. Checklists, workflows and trackers link to it.
            </DialogDescription>
          </DialogHeader>

          {guess && !placementTouched && (
            <div className="rounded-md border border-border bg-secondary px-3 py-2 text-sm">
              <p>
                Looks like <strong>{guess.company}</strong> in <strong>{guess.geo.name}</strong>.
              </p>
              <button type="button" className="mt-1 font-medium underline underline-offset-4" onClick={() => place(guess.company, guess.geo.name, "")}>
                Use {guess.company} and {guess.geo.name}
              </button>
            </div>
          )}

          <Field label="Company" htmlFor="account-company" required={needsPlacement} hint="Type to pick an existing company, or add a new one. There is only ever one of each.">
            <Input
              id="account-company"
              list="account-company-options"
              value={company}
              onChange={(e) => place(e.target.value, geoText, geoCode)}
              autoFocus={!editing}
              maxLength={120}
              autoComplete="off"
            />
            <datalist id="account-company-options">
              {companies.map((c) => (
                <option key={c.id} value={c.name} />
              ))}
            </datalist>
            {company.trim() !== "" && (
              <p className="text-xs text-muted-foreground" aria-live="polite">
                {matched
                  ? `Using the existing company ${matched.name}${matched.accounts.length ? `, which already has ${matched.accounts.map((a) => a.geoCode ?? a.name).join(", ")}` : ""}.`
                  : "A new company will be added."}
              </p>
            )}
          </Field>

          <Field label="Geo" htmlFor="account-geo" required={needsPlacement} hint="Country or region. Type to search the list.">
            <Input id="account-geo" list="account-geo-options" value={geoText} onChange={(e) => place(company, e.target.value, geoCode)} maxLength={60} autoComplete="off" />
            <datalist id="account-geo-options">
              {options.map((g) => (
                <option key={g.name} value={g.name} label={g.code} />
              ))}
            </datalist>
          </Field>

          {needsCode && (
            <Field label="Short code for this geo" htmlFor="account-geo-code" required hint={`“${geoText.trim()}” is not in the list. Give it a short code, for example GBA. It goes in the account name.`}>
              <Input id="account-geo-code" value={geoCode} onChange={(e) => place(company, geoText, e.target.value)} maxLength={12} autoComplete="off" />
            </Field>
          )}

          {clash ? (
            <FormError message={`${matched!.name} already has an account for ${geo!.name}: ${clash.name}. Use that one.`} />
          ) : (
            <div>
              <Field label="Account name" htmlFor="account-name" hint={editing ? "Clients see this name on their tracker link." : generated ? "Built from the company and geo. Change it only if you need to." : "Built from the company and geo once you choose both."}>
                {editing || nameTouched ? (
                  <Input
                    id="account-name"
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      setNameTouched(true);
                    }}
                    maxLength={120}
                  />
                ) : (
                  <div className="flex items-center justify-between gap-2 rounded-md border border-border bg-secondary px-3 py-2">
                    <span id="account-name" className="text-sm font-semibold">
                      {generated || "—"}
                    </span>
                    {generated && (
                      <button
                        type="button"
                        className="text-xs font-medium underline underline-offset-4"
                        onClick={() => {
                          setName(generated);
                          setNameTouched(true);
                        }}
                      >
                        Use a different name
                      </button>
                    )}
                  </div>
                )}
              </Field>
              {renamed && <p className="mt-1 text-xs text-muted-foreground">The name changes from “{account!.name}” to “{shownName.trim()}”.</p>}
            </div>
          )}

          <Field label="Notes" htmlFor="account-notes" hint="Internal only. Clients never see this.">
            <Textarea id="account-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} maxLength={2000} />
          </Field>
          <FormError message={error} />
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving || !ready || Boolean(clash) || (placementTouched && !placementReady && editing)}>
              {saving ? "Saving..." : editing ? "Save account" : "Create account"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
