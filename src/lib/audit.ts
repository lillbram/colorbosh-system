import { db } from "@/db";
import { auditLogs, type auditActionEnum } from "@/db/schema";

type AuditAction = (typeof auditActionEnum.enumValues)[number];

type AuditParams = {
  entityType: string;
  entityId: string;
  action: AuditAction;
  actorId: string | null;
  diff?: unknown;
};

export async function writeAuditLog(
  tx: Pick<typeof db, "insert">,
  { entityType, entityId, action, actorId, diff }: AuditParams
) {
  await tx.insert(auditLogs).values({
    entityType,
    entityId,
    action,
    actorId,
    diff: diff ?? null,
  });
}

/**
 * Wraps a write in a transaction and appends an audit_logs row after it.
 * For CREATE actions where the row's id isn't known until after `fn` runs,
 * pass `entityId` as a getter (`() => newId`) — it's resolved after `fn`
 * completes, since the literal id doesn't exist beforehand.
 */
export async function withAudit<T>(
  params: Omit<AuditParams, "diff" | "entityId"> & {
    entityId: string | (() => string);
    diff?: unknown;
  },
  fn: (tx: typeof db) => Promise<T>
): Promise<T> {
  return db.transaction(async (tx) => {
    const result = await fn(tx as unknown as typeof db);
    const entityId =
      typeof params.entityId === "function" ? params.entityId() : params.entityId;
    await writeAuditLog(tx as unknown as typeof db, { ...params, entityId });
    return result;
  });
}
