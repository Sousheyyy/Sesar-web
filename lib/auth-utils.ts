import { auth } from "@/lib/auth";
import { UserRole } from "@prisma/client";
import { redirect } from "next/navigation";

export async function getSession() {
  return await auth();
}

export async function getCurrentUser() {
  const session = await getSession();
  return session?.user;
}

export async function requireAuth() {
  const session = await getSession();
  if (!session?.user) {
    redirect("/login");
  }
  return session.user;
}

export async function requireRole(allowedRoles: UserRole[]) {
  const user = await requireAuth();
  if (!allowedRoles.includes(user.role)) {
    redirect("/unauthorized");
  }
  return user;
}

export async function requireAdmin() {
  return await requireRole([UserRole.ADMIN]);
}

export async function requireArtist() {
  return await requireRole([UserRole.ARTIST, UserRole.ADMIN]);
}

export async function requireCreator() {
  return await requireRole([UserRole.CREATOR, UserRole.ARTIST, UserRole.ADMIN]);
}











