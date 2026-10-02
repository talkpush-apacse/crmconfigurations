import { prisma } from "@/lib/db";
import { z } from "zod";
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
    include: { _count: { select: { projects: true, people: true } } },
  });
  return accounts.map((a) => ({
    ...serializeAccount(a),
    projectCount: a._count.projects,
    peopleCount: a._count.people,
  }));
}

export async function createAccount(input: unknown) {
  const data = accountCreateSchema.parse(input);
  const account = await prisma.trackerAccount.create({
    data: { name: data.name, notes: data.notes ?? null, slug: await uniqueSlug(data.name) },
  });
  return serializeAccount(account);
}

export async function getAccount(id: string) {
  const account = await prisma.trackerAccount.findUnique({
    where: { id },
    include: {
      people: { where: { archived: false }, orderBy: [{ side: "asc" }, { name: "asc" }] },
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
  const existing = await prisma.trackerAccount.findUnique({ where: { id }, select: { id: true } });
  if (!existing) throw notFound("Account");
  const account = await prisma.trackerAccount.update({
    where: { id },
    data: {
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.notes !== undefined ? { notes: data.notes } : {}),
      ...(data.archived !== undefined ? { archived: data.archived } : {}),
    },
  });
  return serializeAccount(account);
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
