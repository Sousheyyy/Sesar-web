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
  // Creators should use the mobile app, not the web app
  // This function is kept for API endpoints that the mobile app uses
  const user = await requireAuth();
  
  // If accessed from web (not API), redirect creators to unauthorized
  if (user.role === UserRole.CREATOR) {
    redirect("/unauthorized?reason=mobile-only");
  }
  
  return user;
}











