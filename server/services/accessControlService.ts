/**
 * Rules for changing roles, privileges, section access and account status.
 * Route middleware already requires a Super Admin for every change; these
 * checks add the protections that depend on who is changed and how.
 */
import { SafeUser, User } from '../types/index.ts';
import { UserRepository } from '../repositories/userRepository.ts';
import { AuditRepository } from '../repositories/auditRepository.ts';
import { AccessRepository } from '../repositories/accessRepository.ts';
import {
  AccessLevel,
  PrivilegeType,
  RoleAccessConfig,
  SectionId,
  StaffRoleCode,
  effectivePrivilege,
  isStaffRole
} from '../../shared/accessControl.ts';

export class AccessRuleError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

export interface ProposedAccessChange {
  role?: string;
  privilege?: PrivilegeType;
  sectionAccess?: Partial<Record<SectionId, AccessLevel>>;
  status?: string;
  deleting?: boolean;
}

const isActiveSuperAdmin = (u: Pick<User, 'role' | 'status' | 'privilege'>) =>
  isStaffRole(u.role) && u.status === 'ACTIVE' && effectivePrivilege(u) === 'SUPER_ADMIN';

export class AccessControlService {
  /**
   * Validate a change to `target` (null when creating) made by `actor`.
   * Throws AccessRuleError with a safe, user-facing message.
   */
  public static async assertChangeAllowed(actor: SafeUser, target: User | null, change: ProposedAccessChange): Promise<void> {
    const touchesAccess =
      change.role !== undefined || change.privilege !== undefined || change.sectionAccess !== undefined ||
      change.status !== undefined || change.deleting;

    if (target && target.id === actor.id && touchesAccess) {
      const changesSomething =
        change.deleting ||
        (change.role !== undefined && change.role !== target.role) ||
        (change.privilege !== undefined && change.privilege !== effectivePrivilege(target)) ||
        change.sectionAccess !== undefined ||
        (change.status !== undefined && change.status !== target.status);
      if (changesSomething) {
        throw new AccessRuleError(403, 'CANNOT_CHANGE_OWN_ACCESS', 'You cannot change your own role, privilege, access or status.');
      }
    }

    if (target && !isStaffRole(target.role)) {
      throw new AccessRuleError(404, 'EMPLOYEE_NOT_FOUND', 'Employee not found.');
    }
    if (change.role !== undefined && !isStaffRole(change.role)) {
      throw new AccessRuleError(400, 'INVALID_ROLE', 'Role must be one of Owner, Manager, Staff, Kitchen Staff or Delivery Staff.');
    }

    // Owner accounts are managed by Owners only (creating, editing or assigning the role).
    const involvesOwner = target?.role === 'ADMIN' || change.role === 'ADMIN';
    if (involvesOwner && actor.role !== 'ADMIN') {
      if (target?.role === 'ADMIN') throw new AccessRuleError(404, 'EMPLOYEE_NOT_FOUND', 'Employee not found.');
      throw new AccessRuleError(403, 'OWNER_ROLE_RESTRICTED', 'Only an Owner can assign the Owner role.');
    }

    // Never leave the system without an active Super Admin.
    if (target && isActiveSuperAdmin(target)) {
      const after = {
        role: change.role ?? target.role,
        status: change.deleting ? 'REMOVED' : (change.status ?? target.status),
        privilege: change.privilege ?? target.privilege
      } as Pick<User, 'role' | 'status' | 'privilege'>;
      // A role change without an explicit privilege falls back to the new role's default.
      if (change.role !== undefined && change.role !== target.role && change.privilege === undefined && target.privilege === undefined) {
        after.privilege = undefined;
      }
      if (!isActiveSuperAdmin(after)) {
        const others = (await UserRepository.findEmployees()).filter((u) => u.id !== target.id && isActiveSuperAdmin(u));
        if (others.length === 0) {
          throw new AccessRuleError(409, 'LAST_SUPER_ADMIN', 'This is the last active Super Admin. Grant Super Admin to another user first.');
        }
      }
    }
  }

  /** Audit trail entry for sensitive access changes. */
  public static recordChange(actor: SafeUser, target: Pick<User, 'id'>, action: string, before: unknown, after: unknown, details?: string) {
    AuditRepository.record({
      adminId: actor.id,
      adminEmail: actor.email,
      action: action as any,
      entity: 'EMPLOYEE' as any,
      entityId: target.id,
      oldValue: before,
      newValue: after,
      details
    });
  }

  /** Update one role's default section access (Roles / Access Control). */
  public static async updateRoleTemplate(
    actor: SafeUser,
    role: StaffRoleCode,
    access: Partial<Record<SectionId, AccessLevel>>
  ): Promise<RoleAccessConfig> {
    const before = AccessRepository.getRoleConfigs().find((c) => c.id === role) || null;
    const config: RoleAccessConfig = { id: role, access, updatedAt: new Date().toISOString(), updatedBy: actor.id };
    await AccessRepository.saveRoleConfig(config);
    this.recordChange(actor, { id: `role:${role}` }, 'ROLE_ACCESS_UPDATED', before?.access || null, access, `Default access updated for role ${role}`);
    return config;
  }
}
