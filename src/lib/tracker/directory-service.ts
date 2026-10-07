import { prisma } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
import { z } from "zod";
import { accountName, customGeo, findGeo, type Geo } from "@/lib/companies/geo";
import { nameKey } from "@/lib/companies/names";
import { badRequest, notFound } from "./errors";
import { serializeAccount, serializePerson } from "./serialize";
import {
  accountCreateSchema,
  accountUpdateSchema,
  personCreateSchema,
  personUpdateSchema,
} from "./validations";

function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return base || "account";
}

async function uniqueSlug(name: string): Promise<string> {
  const base = slugify(name);
  for (let n = 0; n < 50; n++) {
    const candidate = n === 0 ? base : `${base}-${n + 1}`;
    const taken = await prisma.trackerAccount.findUnique({ where: { slug: candidate }, select: { id: true } });
    if (!taken) return candidate;
  }
  return `${base}-${Date.now()}`;
}

export async function listAccounts(includeArchived = false) {
  const accounts = await prisma.trackerAccount.findMany({
    where: includeArchived ? {} : { archived: false },
    orderBy: { name: "asc" },
    include: { _count: { select: { projects: true, people: true } }, company: { select: { name: true } } },
  });
  return accounts.map((a) => ({
    ...serializeAccount(a),
    projectCount: a._count.projects,
    peopleCount: a._count.people,
  }));
}

/** A geo from what was typed: in the list (by name, code or nickname), or a custom one that comes with its own short code. */
function resolveGeo(geo: string, geoCode?: string): Geo {
  const known = findGeo(geo);
  if (known) return known;
  const custom = geoCode ? customGeo(geo, geoCode) : null;
  if (custom) return custom;
  throw badRequest(`"${geo}" is not in the geo list. Pick one from the list, or give it a short code of your own (geoCode).`);
}

/**
 * The company for a name: the one that already exists (matched ignoring capitals, punctuation and endings like Inc or
 * Corp, so there is only ever one "Concentrix"), or a new one.
 */
export async function findOrCreateCompany(name: string) {
  const clean = name.trim().replace(/\s+/g, " ");
  const key = nameKey(clean);
  if (!key) throw badRequest("Give the company a name.");
  const existing = await prisma.trackerCompany.findUnique({ where: { nameKey: key } });
  if (existing) return existing;
  try {
    return await prisma.trackerCompany.create({ data: { name: clean, nameKey: key } });
  } catch (err) {
    // Two people adding the same company at the same moment: the second one gets the first one's company.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      const winner = await prisma.trackerCompany.findUnique({ where: { nameKey: key } });
      if (winner) return winner;
    }
    throw err;
  }
}

async function companyFor(data: { company?: string; companyId?: string }) {
  if (data.companyId) {
    const found = await prisma.trackerCompany.findUnique({ where: { id: data.companyId } });
    if (!found) throw notFound("Company");
    return found;
  }
  return findOrCreateCompany(data.company as string);
}

/** Said when a company already has an account for that geo, naming it so the person can use it instead. */
async function duplicateGeoError(companyId: string, companyName: string, geo: Geo) {
  const existing = await prisma.trackerAccount.findFirst({ where: { companyId, geoCode: geo.code }, select: { name: true } });
  return badRequest(`${companyName} already has an account for ${geo.name}${existing ? `: ${existing.name}` : ""}. Use that one.`);
}

const isUniqueViolation = (err: unknown) => err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";

export async function createAccount(input: unknown) {
  const data = accountCreateSchema.parse(input);

  // An account with no company: just a typed name (how accounts were made before companies existed).
  if (!data.company && !data.companyId) {
    const account = await prisma.trackerAccount.create({
      data: { name: data.name as string, notes: data.notes ?? null, slug: await uniqueSlug(data.name as string) },
    });
    return serializeAccount(account);
  }

  const geo = resolveGeo(data.geo as string, data.geoCode);
  const company = await companyFor(data);
  const name = data.name ?? accountName(company.name, geo);
  try {
    const account = await prisma.trackerAccount.create({
      data: { name, notes: data.notes ?? null, slug: await uniqueSlug(name), companyId: company.id, geo: geo.name, geoCode: geo.code },
      include: { company: { select: { name: true } } },
    });
    return serializeAccount(account);
  } catch (err) {
    if (isUniqueViolation(err)) throw await duplicateGeoError(company.id, company.name, geo);
    throw err;
  }
}

/** Every company with the geos it already has an account for, for the "New account" form. */
export async function listCompanies() {
  const companies = await prisma.trackerCompany.findMany({
    orderBy: { name: "asc" },
    include: { accounts: { where: { archived: false }, select: { id: true, name: true, geo: true, geoCode: true } } },
  });
  return companies.map((c) => ({ id: c.id, name: c.name, accounts: c.accounts }));
}

export async function getAccount(id: string) {
  const account = await prisma.trackerAccount.findUnique({
    where: { id },
    include: {
      people: { where: { archived: false }, orderBy: [{ side: "asc" }, { name: "asc" }] },
      company: { select: { name: true } },
    },
  });
  if (!account) throw notFound("Account");
  return {
    ...serializeAccount(account),
    people: account.people.map((p) => serializePerson(p)),
  };
}

export async function updateAccount(id: string, input: unknown) {
  const data = accountUpdateSchema.parse(input);
  const existing = await prisma.trackerAccount.findUnique({ where: { id }, include: { company: { select: { id: true, name: true } } } });
  if (!existing) throw notFound("Account");

  // Setting or changing the company or geo: both must end up known, and the name follows unless one was given.
  let placement: { companyId: string; geo: string; geoCode: string; name?: string } | null = null;
  let companyForError: { id: string; name: string } | null = null;
  let geoForError: Geo | null = null;
  if (data.company || data.companyId || data.geo) {
    const company = data.company || data.companyId ? await companyFor(data) : existing.company;
    const geoText = data.geo ?? existing.geo;
    if (!company || !geoText) throw badRequest("Give both a company and a geo.");
    const geo = data.geo ? resolveGeo(data.geo, data.geoCode) : { name: existing.geo as string, code: existing.geoCode as string, kind: "custom" as const };
    placement = { companyId: company.id, geo: geo.name, geoCode: geo.code, ...(data.name === undefined ? { name: accountName(company.name, geo) } : {}) };
    companyForError = company;
    geoForError = geo;
  }

  try {
    const account = await prisma.trackerAccount.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(placement ?? {}),
        ...(data.notes !== undefined ? { notes: data.notes } : {}),
        ...(data.archived !== undefined ? { archived: data.archived } : {}),
      },
      include: { company: { select: { name: true } } },
    });
    return serializeAccount(account);
  } catch (err) {
    if (isUniqueViolation(err) && companyForError && geoForError) throw await duplicateGeoError(companyForError.id, companyForError.name, geoForError);
    throw err;
  }
}

/** People for owner pickers: Talkpush staff plus (optionally) one account's contacts. */
export async function listPeople(opts: { accountId?: string | null; includeStaff?: boolean } = {}) {
  const includeStaff = opts.includeStaff ?? true;
  const or: Array<{ accountId: string | null }> = [];
  if (includeStaff) or.push({ accountId: null });
  if (opts.accountId) or.push({ accountId: opts.accountId });
  const people = await prisma.trackerPerson.findMany({
    where: { archived: false, ...(or.length > 0 ? { OR: or } : {}) },
    orderBy: [{ side: "asc" }, { name: "asc" }],
    include: { account: { select: { name: true } } },
  });
  return people.map((p) => serializePerson(p));
}

export async function createPerson(input: unknown) {
  const data = personCreateSchema.parse(input);

  if (data.side === "talkpush" && data.accountId) {
    throw badRequest("Talkpush staff belong to the team, not to a client account.");
  }
  if (data.side !== "talkpush" && !data.accountId) {
    throw badRequest("Client contacts and vendors must belong to an account.");
  }
  if (data.accountId) {
    const account = await prisma.trackerAccount.findUnique({ where: { id: data.accountId }, select: { id: true } });
    if (!account) throw notFound("Account");
  }
  if (data.adminUserId) {
    const dupe = await prisma.trackerPerson.findFirst({
      where: { adminUserId: data.adminUserId, archived: false },
      select: { id: true },
    });
    if (dupe) throw badRequest("This login is already linked to a team member.");
  }

  const person = await prisma.trackerPerson.create({
    data: {
      accountId: data.accountId,
      side: data.side,
      name: data.name,
      email: data.email ?? null,
      title: data.title ?? null,
      organisation: data.organisation ?? null,
      adminUserId: data.adminUserId,
    },
    include: { account: { select: { name: true } } },
  });
  return serializePerson(person);
}

export async function updatePerson(id: string, input: unknown) {
  const data = personUpdateSchema.parse(input);
  const existing = await prisma.trackerPerson.findUnique({ where: { id }, select: { id: true } });
  if (!existing) throw notFound("Person");
  const person = await prisma.trackerPerson.update({
    where: { id },
    data: {
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.email !== undefined ? { email: data.email } : {}),
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.organisation !== undefined ? { organisation: data.organisation } : {}),
      ...(data.archived !== undefined ? { archived: data.archived } : {}),
    },
    include: { account: { select: { name: true } } },
  });
  return serializePerson(person);
}

/** "Add me": make (or return) the Talkpush team member linked to this login. */
export async function ensureStaffPersonForUser(userId: string) {
  const existing = await prisma.trackerPerson.findFirst({
    where: { adminUserId: userId, archived: false },
    include: { account: { select: { name: true } } },
  });
  if (existing) return serializePerson(existing);

  const user = await prisma.adminUser.findUnique({ where: { id: userId }, select: { email: true } });
  if (!user) throw notFound("User");
  const local = user.email.split("@")[0] ?? user.email;
  const name = local
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
  const person = await prisma.trackerPerson.create({
    data: { side: "talkpush", name: name || user.email, email: user.email, adminUserId: userId },
    include: { account: { select: { name: true } } },
  });
  return serializePerson(person);
}

export const idSchema = z.string().trim().min(1).max(64);
