/**
 * Audit Log Repository
 */
import { db } from '../database/db.ts';
import { AuditLog } from '../types/index.ts';

export class AuditRepository {
  public static getAll(): AuditLog[] {
    return Array.from(db.auditLogs.values()).sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }

  public static getByEntity(entity: AuditLog['entity'], entityId?: string): AuditLog[] {
    return Array.from(db.auditLogs.values())
      .filter((a) => a.entity === entity && (!entityId || a.entityId === entityId))
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  public static record(entry: Omit<AuditLog, 'id' | 'timestamp'>): AuditLog {
    return db.recordAudit(entry);
  }
}
