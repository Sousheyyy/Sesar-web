import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

/**
 * Fire-and-forget admin audit logger.
 * Logs admin actions to AdminAuditLog table without blocking the request.
 */
export function logAdminAction(
  adminId: string,
  adminEmail: string,
  action: string,
  targetType: string,
  targetId?: string,
  details?: Record<string, unknown>
) {
  void (async () => {
    try {
      await prisma.adminAuditLog.create({
        data: {
          adminId,
          adminEmail,
          action,
          targetType,
          targetId: targetId ?? null,
          details: (details as Prisma.InputJsonValue) ?? undefined,
        },
      });
    } catch (err) {
      console.error("Audit log write failed:", err);
    }
  })();
}
