/**
 * Persistence for editable per-role access templates (Roles / Access Control).
 * Stored in the same engine as every other collection: in memory, the local
 * JSON file (dev/test) and the Firestore `accessRoles` collection.
 */
import { db } from '../database/db.ts';
import { saveDocToFirestore } from '../database/firestoreSync.ts';
import { RoleAccessConfig } from '../../shared/accessControl.ts';

export class AccessRepository {
  public static getRoleConfigs(): RoleAccessConfig[] {
    return Array.from(db.accessRoleConfigs.values());
  }

  public static async saveRoleConfig(config: RoleAccessConfig): Promise<RoleAccessConfig> {
    db.accessRoleConfigs.set(config.id, config);
    await saveDocToFirestore('accessRoles', config.id, config);
    db.persist();
    return config;
  }
}
