import "server-only";

import { cookies } from "next/headers";
import { findUserByEmail, findUserById, upsertSuperAdmin } from "@/lib/queries";
import {
  SESSION_COOKIE,
  isSuperAdminEmail,
  signSession,
  verifySession,
  type SessionPayload,
} from "@/lib/session";
import type { User } from "@/lib/types";

export async function readSession(): Promise<SessionPayload | null> {
  const jar = await cookies();
  return verifySession(jar.get(SESSION_COOKIE)?.value);
}

export async function getCurrentUser(): Promise<User | null> {
  const session = await readSession();
  if (!session) return null;
  const user = await findUserById(session.sub);
  if (!user || user.email !== session.email) return null;
  if (user.role === "super_admin" && !isSuperAdminEmail(user.email)) return null;
  if (user.role !== session.role) return null;
  return user;
}

export async function userForEmail(email: string, profileName?: string) {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return null;
  if (isSuperAdminEmail(normalized)) {
    const name = profileName?.trim() || normalized.split("@")[0] || "Admin";
    return upsertSuperAdmin(normalized, name);
  }
  const existing = await findUserByEmail(normalized);
  if (!existing || (existing.role !== "client" && existing.role !== "admin")) return null;
  return existing;
}

export async function sessionTokenFor(user: User) {
  return signSession({ id: user.id, email: user.email, role: user.role });
}
