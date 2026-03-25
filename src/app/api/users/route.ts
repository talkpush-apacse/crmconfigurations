import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/api-auth";
import { hashPassword } from "@/lib/auth";
import type { Role } from "@/lib/types";

const VALID_ROLES: Role[] = ["ADMIN", "EDITOR", "VIEWER"];

export async function GET(request: NextRequest) {
  try {
    const auth = requireRole(request, ["ADMIN"]);
    if (auth instanceof NextResponse) return auth;

    const users = await prisma.adminUser.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        email: true,
        role: true,
        createdAt: true,
        _count: { select: { assignments: true } },
      },
    });

    const items = users.map((u) => ({
      id: u.id,
      email: u.email,
      role: u.role,
      createdAt: u.createdAt,
      assignmentCount: u._count.assignments,
    }));

    return NextResponse.json({ items });
  } catch (err) {
    console.error("GET /api/users error:", err);
    return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = requireRole(request, ["ADMIN"]);
    if (auth instanceof NextResponse) return auth;

    const { email, password, role } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
    }

    if (role && !VALID_ROLES.includes(role)) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    }

    const existing = await prisma.adminUser.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: "A user with this email already exists" }, { status: 409 });
    }

    const passwordHash = await hashPassword(password);
    const user = await prisma.adminUser.create({
      data: { email, passwordHash, role: role || "EDITOR" },
      select: { id: true, email: true, role: true, createdAt: true },
    });

    return NextResponse.json(user, { status: 201 });
  } catch (err) {
    console.error("POST /api/users error:", err);
    return NextResponse.json({ error: "Failed to create user" }, { status: 500 });
  }
}
