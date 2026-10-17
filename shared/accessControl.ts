/**
 * Staff roles, privilege types and section-level access control.
 *
 * Three separate concepts:
 *  - Role       — operational responsibility (Owner, Manager, Staff, …)
 *  - Privilege  — administrative authority (SUPER_ADMIN or USER)
 *  - Access     — per application section: FULL, VIEW or NONE
 *
 * Resolution (same code on server and client):
 *  1. Not an active staff account            → NONE
 *  2. Effective privilege SUPER_ADMIN        → FULL
 *  3. Explicit per-user override for section → that level
 *  4. Role default for section               → that level
 *  5. Otherwise                              → NONE (least privilege)
 *
 * Role codes stay the existing ones (ADMIN, MANAGER, STAFF, KITCHEN, DELIVERY)
 * so sessions, tokens and stored data keep working; the display names are the
 * five predefined roles.
 */

export type StaffRoleCode = 'ADMIN' | 'MANAGER' | 'STAFF' | 'KITCHEN' | 'DELIVERY';
export type PrivilegeType = 'SUPER_ADMIN' | 'USER';
export type AccessLevel = 'FULL' | 'VIEW' | 'NONE';

export type SectionId =
  | 'DASHBOARD'
  | 'USERS'
  | 'ROLES'
  | 'PRIVILEGES'
  | 'ACCESS_CONTROL'
  | 'POS'
  | 'ORDERS'
  | 'BOOKINGS'
  | 'TABLES'
  | 'MENU'
  | 'INVENTORY'
  | 'KITCHEN'
  | 'DELIVERY'
  | 'BILLING'
  | 'PAYMENTS'
  | 'REPORTS'
  | 'CUSTOMERS'
  | 'SETTINGS';

export interface SectionDefinition {
  id: SectionId;
  label: string;
  description: string;
  group: 'Administration' | 'Operations' | 'Catalog' | 'Finance' | 'Insights';
  /** Changing data in this section always requires Super Admin (FULL only lets non-admins view). */
  superAdminWrites?: boolean;
}

export const SECTIONS: SectionDefinition[] = [
  { id: 'DASHBOARD', label: 'Dashboard', description: 'Operations overview and live metrics', group: 'Insights' },
  { id: 'REPORTS', label: 'Reports & Analytics', description: 'Sales, billing and operational reports, audit trail', group: 'Insights' },
  { id: 'POS', label: 'Take Order (POS)', description: 'Create walk-in / table orders at the counter', group: 'Operations' },
  { id: 'ORDERS', label: 'Orders', description: 'View orders, update status, add items, payment status', group: 'Operations' },
  { id: 'BOOKINGS', label: 'Reservations', description: 'Table bookings and seating', group: 'Operations' },
  { id: 'TABLES', label: 'Tables & QR', description: 'Dining tables and table QR codes', group: 'Operations' },
  { id: 'KITCHEN', label: 'Kitchen Display', description: 'Kitchen ticket board and preparation status', group: 'Operations' },
  { id: 'DELIVERY', label: 'Delivery Management', description: 'Delivery assignments and delivery status updates', group: 'Operations' },
  { id: 'MENU', label: 'Menu Management', description: 'Dishes, categories, portions, add-ons and availability', group: 'Catalog' },
  { id: 'INVENTORY', label: 'Inventory & Purchases', description: 'Stock, recipes, suppliers, purchases and wastage', group: 'Catalog' },
  { id: 'BILLING', label: 'Billing & Invoices', description: 'Bill requests, invoices and cashier collection', group: 'Finance' },
  { id: 'PAYMENTS', label: 'Payments', description: 'Payment records, reconciliation and refunds', group: 'Finance' },
  { id: 'CUSTOMERS', label: 'Customers', description: 'Customer directory and order history', group: 'Insights' },
  { id: 'SETTINGS', label: 'System Settings', description: 'Payment, billing and data-retention settings', group: 'Administration', superAdminWrites: true },
  { id: 'USERS', label: 'User Management', description: 'Staff accounts', group: 'Administration', superAdminWrites: true },
  { id: 'ROLES', label: 'Roles', description: 'Role definitions and default access', group: 'Administration', superAdminWrites: true },
  { id: 'PRIVILEGES', label: 'Privileges', description: 'Super Admin / User privilege assignments', group: 'Administration', superAdminWrites: true },
  { id: 'ACCESS_CONTROL', label: 'Access Control', description: 'Section-level permission matrix', group: 'Administration', superAdminWrites: true }
];

export const SECTION_IDS: SectionId[] = SECTIONS.map((s) => s.id);
export const ACCESS_LEVELS: AccessLevel[] = ['FULL', 'VIEW', 'NONE'];
export const PRIVILEGE_TYPES: PrivilegeType[] = ['SUPER_ADMIN', 'USER'];

export const ACCESS_LABELS: Record<AccessLevel, string> = { FULL: 'Full Access', VIEW: 'View Access', NONE: 'No Access' };
export const PRIVILEGE_LABELS: Record<PrivilegeType, string> = { SUPER_ADMIN: 'Super Admin', USER: 'User' };

export interface RoleDefinition {
  code: StaffRoleCode;
  name: string;
  purpose: string;
  defaultPrivilege: PrivilegeType;
  defaultAccess: Partial<Record<SectionId, AccessLevel>>;
}

const allFull = Object.fromEntries(SECTION_IDS.map((id) => [id, 'FULL'])) as Record<SectionId, AccessLevel>;

/** The five predefined roles and their default templates. */
export const ROLE_DEFINITIONS: RoleDefinition[] = [
  {
    code: 'ADMIN',
    name: 'Owner',
    purpose: 'Overall hotel and restaurant operations, business oversight and administrative management.',
    defaultPrivilege: 'SUPER_ADMIN',
    defaultAccess: allFull
  },
  {
    code: 'MANAGER',
    name: 'Manager',
    purpose: 'Day-to-day operations, staff supervision, menu, orders, inventory, bookings and reporting.',
    defaultPrivilege: 'SUPER_ADMIN',
    defaultAccess: allFull
  },
  {
    code: 'STAFF',
    name: 'Staff',
    purpose: 'Front-of-house operations: taking orders, reservations, seating and billing.',
    defaultPrivilege: 'USER',
    defaultAccess: { POS: 'FULL', ORDERS: 'FULL', BOOKINGS: 'FULL', BILLING: 'FULL', TABLES: 'VIEW', MENU: 'VIEW', KITCHEN: 'VIEW', INVENTORY: 'VIEW' }
  },
  {
    code: 'KITCHEN',
    name: 'Kitchen Staff',
    purpose: 'Kitchen operations, order preparation and the kitchen display.',
    defaultPrivilege: 'USER',
    defaultAccess: { KITCHEN: 'FULL', ORDERS: 'VIEW', MENU: 'VIEW', INVENTORY: 'VIEW' }
  },
  {
    code: 'DELIVERY',
    name: 'Delivery Staff',
    purpose: 'Delivery assignments and delivery status updates.',
    defaultPrivilege: 'USER',
    defaultAccess: { DELIVERY: 'FULL', ORDERS: 'VIEW' }
  }
];

export const STAFF_ROLE_CODES: StaffRoleCode[] = ROLE_DEFINITIONS.map((r) => r.code);

export function isStaffRole(role: string | undefined): role is StaffRoleCode {
  return !!role && (STAFF_ROLE_CODES as string[]).includes(role);
}

export function roleDisplayName(role: string | undefined): string {
  if (role === 'CUSTOMER') return 'Customer';
  return ROLE_DEFINITIONS.find((r) => r.code === role)?.name || 'Unknown';
}

/** Stored, editable per-role access template (Roles / Access Control tabs). */
export interface RoleAccessConfig {
  id: StaffRoleCode;
  access: Partial<Record<SectionId, AccessLevel>>;
  updatedAt?: string;
  updatedBy?: string;
}

export interface AccessSubject {
  id?: string;
  role: string;
  status?: string;
  privilege?: PrivilegeType;
  sectionAccess?: Partial<Record<SectionId, AccessLevel>>;
}

/** Role access template: stored configuration if present, else the predefined default. */
export function roleAccessTemplate(role: string, configs: RoleAccessConfig[] = []): Partial<Record<SectionId, AccessLevel>> {
  const def = ROLE_DEFINITIONS.find((r) => r.code === role);
  if (!def) return {};
  const stored = configs.find((c) => c.id === role);
  return { ...def.defaultAccess, ...(stored?.access || {}) };
}

/**
 * Privilege for a user: the explicit stored value when present, otherwise the
 * default of their (trusted) existing role. Non-staff accounts never have one.
 */
export function effectivePrivilege(user: AccessSubject | null | undefined): PrivilegeType | null {
  if (!user || !isStaffRole(user.role)) return null;
  if (user.privilege === 'SUPER_ADMIN' || user.privilege === 'USER') return user.privilege;
  return ROLE_DEFINITIONS.find((r) => r.code === user.role)!.defaultPrivilege;
}

export function isSuperAdmin(user: AccessSubject | null | undefined): boolean {
  return !!user && (user.status === undefined || user.status === 'ACTIVE') && effectivePrivilege(user) === 'SUPER_ADMIN';
}

export function resolveSectionAccess(user: AccessSubject | null | undefined, section: SectionId, configs: RoleAccessConfig[] = []): AccessLevel {
  if (!user || !isStaffRole(user.role)) return 'NONE';
  if (user.status !== undefined && user.status !== 'ACTIVE') return 'NONE';
  if (effectivePrivilege(user) === 'SUPER_ADMIN') return 'FULL';
  const override = user.sectionAccess?.[section];
  if (override && ACCESS_LEVELS.includes(override)) return override;
  return roleAccessTemplate(user.role, configs)[section] || 'NONE';
}

export function resolveAllAccess(user: AccessSubject | null | undefined, configs: RoleAccessConfig[] = []): Record<SectionId, AccessLevel> {
  return Object.fromEntries(SECTION_IDS.map((id) => [id, resolveSectionAccess(user, id, configs)])) as Record<SectionId, AccessLevel>;
}

/** Can the user perform `need` (VIEW = read, FULL = modify) in a section? */
export function hasAccess(level: AccessLevel | undefined, need: 'VIEW' | 'FULL'): boolean {
  if (need === 'VIEW') return level === 'VIEW' || level === 'FULL';
  return level === 'FULL';
}

/** Where a level came from, for "inherited vs custom" indicators. */
export function accessSource(user: AccessSubject, section: SectionId): 'SUPER_ADMIN' | 'CUSTOM' | 'ROLE' {
  if (effectivePrivilege(user) === 'SUPER_ADMIN') return 'SUPER_ADMIN';
  return user.sectionAccess?.[section] ? 'CUSTOM' : 'ROLE';
}
