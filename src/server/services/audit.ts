import "server-only";
import type { Db, Tx } from "@/server/db";

export type AuditEntry = {
  actorId: string | null;
  action: string;
  entity: "user" | "course" | "subject" | "announcement" | "submission";
  entityId?: string | null;
  summary: string;
};

export async function recordAudit(client: Db | Tx, entry: AuditEntry): Promise<void> {
  await client.auditLog.create({
    data: {
      actorId: entry.actorId,
      action: entry.action,
      entity: entry.entity,
      entityId: entry.entityId ?? null,
      summary: entry.summary,
    },
  });
}
