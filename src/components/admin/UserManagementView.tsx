/**
 * User Management: Users, Roles, Privileges and Access Control.
 * Tabs appear according to the signed-in user's section access; changes are
 * Super Admin only and are enforced again by the API.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { KeyRound, Layers, Loader2, RotateCcw, ShieldCheck, Users } from 'lucide-react';
import { AdminEmployeesView } from './AdminEmployeesView.tsx';
import { AccessLevelChip } from './AccessEditor.tsx';
import { Chip, DataTable, StatusPill, rowIconBtn } from './DataTable.tsx';
import { AccessOverview, ManagerApi } from '../../api/index.ts';
import { useAuth } from '../../context/AuthContext.tsx';
import { useToast } from '../../context/ToastContext.tsx';
import { Modal } from '../common/Footer.tsx';
import {
  ACCESS_LABELS,
  PRIVILEGE_LABELS,
  AccessLevel,
  PrivilegeType,
  SECTIONS,
  SectionId,
  StaffRoleCode,
  accessSource,
  effectivePrivilege,
  resolveSectionAccess,
  roleDisplayName
} from '../../../shared/accessControl.ts';
import type { SafeUser } from '../../types/index.ts';

type UMTab = 'USERS' | 'ROLES' | 'PRIVILEGES' | 'ACCESS_CONTROL';

const TABS: Array<{ id: UMTab; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: 'USERS', label: 'Users', icon: Users },
  { id: 'ROLES', label: 'Roles', icon: Layers },
  { id: 'PRIVILEGES', label: 'Privileges', icon: ShieldCheck },
  { id: 'ACCESS_CONTROL', label: 'Access Control', icon: KeyRound }
];

const GROUPS = ['Insights', 'Operations', 'Catalog', 'Finance', 'Administration'] as const;

const selectCls =
  'w-full min-w-[118px] px-2 py-1.5 bg-white border border-stone-200 rounded-lg text-[11.5px] text-stone-800 focus:outline-hidden focus:border-amber-600 disabled:opacity-60 disabled:cursor-not-allowed';

export const UserManagementView: React.FC<{ onRefreshStats?: () => void }> = ({ onRefreshStats }) => {
  const { can, isSuperAdmin, user } = useAuth();
  const visibleTabs = TABS.filter((t) => can(t.id, 'VIEW'));
  const [tab, setTab] = useState<UMTab>(visibleTabs[0]?.id || 'USERS');
  const [overview, setOverview] = useState<AccessOverview | null>(null);
  const [loadError, setLoadError] = useState('');

  const load = useCallback(async () => {
    try {
      setOverview(await ManagerApi.getAccessOverview());
      setLoadError('');
    } catch (err: any) {
      setLoadError(err.message || 'Unable to load access settings.');
    }
  }, []);

  useEffect(() => {
    if (tab !== 'USERS') load();
  }, [tab, load]);

  if (visibleTabs.length === 0) {
    return <p className="p-6 bg-white rounded-2xl border border-stone-200 text-sm text-stone-600">You do not have access to User Management.</p>;
  }

  return (
    <div className="space-y-3">
      <div className="bg-white rounded-2xl border border-[var(--border-subtle)] px-4 py-2.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <h2 className="lux-display text-xl text-stone-900 flex items-center gap-2">
          <Users className="w-[18px] h-[18px] text-[var(--brand)]" /> User Management
        </h2>
        <div className="flex gap-1 p-1 rounded-xl bg-stone-100/80 overflow-x-auto" role="tablist" aria-label="User management sections">
          {visibleTabs.map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={tab === t.id}
                onClick={() => setTab(t.id)}
                className={`inline-flex items-center gap-1.5 px-3 min-h-8 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                  tab === t.id ? 'bg-white text-[var(--brand-text)] shadow-sm' : 'text-stone-600 hover:text-[var(--brand-text)] hover:bg-white/60'
                }`}
              >
                <Icon className="w-3.5 h-3.5" /> {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {tab === 'USERS' && <AdminEmployeesView onRefreshStats={onRefreshStats} />}

      {tab !== 'USERS' && !overview && !loadError && (
        <div className="p-10 flex justify-center bg-white rounded-2xl border border-[var(--border-subtle)]">
          <Loader2 className="w-6 h-6 animate-spin text-[var(--brand)]" />
        </div>
      )}
      {tab !== 'USERS' && loadError && (
        <p className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-sm text-rose-800" role="alert">{loadError}</p>
      )}

      {overview && tab === 'ROLES' && (
        <RolesTab overview={overview} onEditAccess={() => setTab('ACCESS_CONTROL')} canEdit={isSuperAdmin && can('ACCESS_CONTROL', 'VIEW')} onRefresh={load} />
      )}
      {overview && tab === 'PRIVILEGES' && <PrivilegesTab overview={overview} currentUserId={user?.id} currentRole={user?.role} canEdit={isSuperAdmin} onChanged={load} />}
      {overview && tab === 'ACCESS_CONTROL' && <AccessControlTab overview={overview} currentUserId={user?.id} currentRole={user?.role} canEdit={isSuperAdmin} onChanged={load} />}
    </div>
  );
};

/* ------------------------------- Roles ---------------------------------- */
type RoleRow = AccessOverview['roles'][number];

const roleAccessSummary = (role: RoleRow) => {
  if (role.defaultPrivilege === 'SUPER_ADMIN') return 'All sections';
  const full = SECTIONS.filter((s) => role.access[s.id] === 'FULL').length;
  const view = SECTIONS.filter((s) => role.access[s.id] === 'VIEW').length;
  return `${full} full · ${view} view`;
};

const RolesTab: React.FC<{ overview: AccessOverview; canEdit: boolean; onEditAccess: () => void; onRefresh: () => void }> = ({ overview, canEdit, onEditAccess, onRefresh }) => {
  const members = (code: string) => overview.users.filter((u) => u.role === code).length;
  return (
    <DataTable<RoleRow>
      title="Roles"
      rows={overview.roles}
      rowKey={(r) => r.code}
      minWidth={860}
      searchText={(r) => `${r.name} ${r.purpose}`}
      searchPlaceholder="Search roles"
      onRefresh={onRefresh}
      exportName="roles"
      exportRow={(r) => ({
        Role: r.name,
        Description: r.purpose,
        'Default privilege': PRIVILEGE_LABELS[r.defaultPrivilege],
        Access: roleAccessSummary(r),
        Users: String(members(r.code)),
        Status: 'Active'
      })}
      columns={[
        { key: 'name', header: 'Role name', sortValue: (r) => r.name, render: (r) => <span className="font-semibold text-[var(--brand-text)] whitespace-nowrap">{r.name}</span> },
        { key: 'purpose', header: 'Description', render: (r) => <span className="text-stone-600">{r.purpose}</span> },
        {
          key: 'privilege',
          header: 'Default privilege',
          sortValue: (r) => r.defaultPrivilege,
          render: (r) => <Chip tone={r.defaultPrivilege === 'SUPER_ADMIN' ? 'brand' : 'muted'}>{PRIVILEGE_LABELS[r.defaultPrivilege]}</Chip>
        },
        {
          key: 'access',
          header: 'Default access',
          render: (r) => (
            <span className="whitespace-nowrap text-stone-600">
              {roleAccessSummary(r)}
              {r.customized && <span className="ml-1.5 text-[10.5px] text-[var(--brand-text)]" title={r.updatedAt ? `Customised ${new Date(r.updatedAt).toLocaleString()}` : 'Customised'}>· customised</span>}
            </span>
          )
        },
        {
          key: 'users',
          header: 'Users',
          sortValue: (r) => members(r.code),
          render: (r) => <Chip>{members(r.code)} user{members(r.code) === 1 ? '' : 's'}</Chip>
        },
        { key: 'status', header: 'Status', render: () => <StatusPill active /> }
      ]}
      rowActions={
        canEdit
          ? (r) =>
              r.defaultPrivilege === 'USER' ? (
                <button type="button" onClick={onEditAccess} className={rowIconBtn} title="Edit default access" aria-label={`Edit default access for ${r.name}`}>
                  <KeyRound className="w-3.5 h-3.5" />
                </button>
              ) : (
                <span className="text-[11px] text-stone-400" title="Super Admin roles always have full access">—</span>
              )
          : undefined
      }
    />
  );
};

/* ----------------------------- Privileges -------------------------------- */
const PRIVILEGE_INFO: Array<{ id: PrivilegeType; description: string }> = [
  { id: 'SUPER_ADMIN', description: 'Full access to every section, including user, role, privilege and access management. Default for Owner and Manager.' },
  { id: 'USER', description: 'Uses only the sections their role and assigned access allow. Default for Staff, Kitchen Staff and Delivery Staff.' }
];

const PrivilegesTab: React.FC<{ overview: AccessOverview; currentUserId?: string; currentRole?: string; canEdit: boolean; onChanged: () => void }> = ({
  overview,
  currentUserId,
  currentRole,
  canEdit,
  onChanged
}) => {
  const { success, error } = useToast();
  const [confirm, setConfirm] = useState<{ user: SafeUser; to: PrivilegeType } | null>(null);
  const [saving, setSaving] = useState(false);
  const holders = (p: PrivilegeType) => overview.users.filter((u) => (effectivePrivilege(u) || 'USER') === p).length;

  const apply = async () => {
    if (!confirm) return;
    setSaving(true);
    try {
      await ManagerApi.updateEmployee(confirm.user.id, { privilege: confirm.to });
      success(`${confirm.user.firstName} is now ${confirm.to === 'SUPER_ADMIN' ? 'a Super Admin' : 'a User'}.`);
      setConfirm(null);
      onChanged();
    } catch (err: any) {
      error(err.message || 'Unable to change privilege.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      <DataTable<(typeof PRIVILEGE_INFO)[number]>
        title="Privileges"
        rows={PRIVILEGE_INFO}
        rowKey={(p) => p.id}
        minWidth={640}
        onRefresh={onChanged}
        exportName="privileges"
        exportRow={(p) => ({ Privilege: PRIVILEGE_LABELS[p.id], Description: p.description, Users: String(holders(p.id)), Status: 'Active' })}
        columns={[
          { key: 'name', header: 'Privilege name', sortValue: (p) => PRIVILEGE_LABELS[p.id], render: (p) => <span className="font-semibold text-[var(--brand-text)] whitespace-nowrap">{PRIVILEGE_LABELS[p.id]}</span> },
          { key: 'description', header: 'Description', render: (p) => <span className="text-stone-600">{p.description}</span> },
          { key: 'users', header: 'Users', sortValue: (p) => holders(p.id), render: (p) => <Chip>{holders(p.id)} user{holders(p.id) === 1 ? '' : 's'}</Chip> },
          { key: 'status', header: 'Status', render: () => <StatusPill active /> }
        ]}
      />

      <DataTable<SafeUser>
        title="Privilege assignments"
        rows={overview.users}
        rowKey={(u) => u.id}
        minWidth={760}
        searchText={(u) => `${u.firstName} ${u.lastName} ${roleDisplayName(u.role)}`}
        searchPlaceholder="Search users"
        exportName="privilege-assignments"
        exportRow={(u) => ({
          User: `${u.firstName} ${u.lastName}`,
          Role: roleDisplayName(u.role),
          Privilege: PRIVILEGE_LABELS[effectivePrivilege(u) || 'USER'],
          Source: u.privilege ? 'Assigned' : 'Role default'
        })}
        columns={[
          {
            key: 'user',
            header: 'User',
            sortValue: (u) => `${u.firstName} ${u.lastName}`.toLowerCase(),
            render: (u) => (
              <span className="font-semibold text-[var(--brand-text)] whitespace-nowrap">
                {u.firstName} {u.lastName}
                {u.id === currentUserId && <span className="ml-1 font-normal text-stone-400">(you)</span>}
              </span>
            )
          },
          { key: 'role', header: 'Role', sortValue: (u) => roleDisplayName(u.role), render: (u) => <Chip>{roleDisplayName(u.role)}</Chip> },
          {
            key: 'privilege',
            header: 'Privilege',
            sortValue: (u) => effectivePrivilege(u) || '',
            render: (u) => {
              const p = effectivePrivilege(u) || 'USER';
              return <Chip tone={p === 'SUPER_ADMIN' ? 'brand' : 'muted'}>{PRIVILEGE_LABELS[p]}</Chip>;
            }
          },
          { key: 'source', header: 'Source', render: (u) => <span className="text-stone-500">{u.privilege ? 'Assigned' : 'Role default'}</span> }
        ]}
        rowActions={(u) => {
          const priv = effectivePrivilege(u) || 'USER';
          const isSelf = u.id === currentUserId;
          const ownerLocked = u.role === 'ADMIN' && currentRole !== 'ADMIN';
          if (!canEdit || isSelf || ownerLocked) return <span className="text-[11px] text-stone-400">{isSelf ? 'Your account' : 'View only'}</span>;
          return (
            <button
              type="button"
              onClick={() => setConfirm({ user: u, to: priv === 'SUPER_ADMIN' ? 'USER' : 'SUPER_ADMIN' })}
              className="h-7 px-2.5 rounded-full border border-[var(--brand-border)] text-[11px] font-semibold text-[var(--brand-text)] hover:bg-[var(--brand-soft)] cursor-pointer"
            >
              {priv === 'SUPER_ADMIN' ? 'Revoke Super Admin' : 'Grant Super Admin'}
            </button>
          );
        }}
      />

      {confirm && (
        <Modal isOpen={!!confirm} onClose={() => setConfirm(null)} title={confirm.to === 'SUPER_ADMIN' ? 'Grant Super Admin?' : 'Revoke Super Admin?'} maxWidth="max-w-md">
          <div className="space-y-4 text-sm text-stone-700">
            <p>
              {confirm.to === 'SUPER_ADMIN'
                ? `${confirm.user.firstName} ${confirm.user.lastName} will be able to manage users, roles, access and settings, with full access to every section.`
                : `${confirm.user.firstName} ${confirm.user.lastName} will keep only the sections allowed by the ${roleDisplayName(confirm.user.role)} role and their custom access.`}
            </p>
            <div className="flex justify-end gap-2">
              <button type="button" className="btn btn-secondary" onClick={() => setConfirm(null)}>Cancel</button>
              <button type="button" className={`btn ${confirm.to === 'SUPER_ADMIN' ? 'btn-primary' : 'btn-danger'}`} disabled={saving} onClick={apply}>
                {saving ? 'Saving…' : confirm.to === 'SUPER_ADMIN' ? 'Grant Super Admin' : 'Revoke Super Admin'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

/* --------------------------- Access Control ------------------------------ */
const AccessControlTab: React.FC<{ overview: AccessOverview; currentUserId?: string; currentRole?: string; canEdit: boolean; onChanged: () => void }> = ({
  overview,
  currentUserId,
  currentRole,
  canEdit,
  onChanged
}) => {
  const { success, error } = useToast();
  const [mode, setMode] = useState<'ROLES' | 'USER'>('ROLES');
  const [draft, setDraft] = useState<Record<string, Partial<Record<SectionId, AccessLevel>>>>({});
  const [saving, setSaving] = useState(false);
  const [confirmSave, setConfirmSave] = useState(false);
  const [userId, setUserId] = useState<string>('');
  const [userDraft, setUserDraft] = useState<Partial<Record<SectionId, AccessLevel>> | null>(null);

  // Only roles whose users default to the User privilege are governed by these templates.
  const roles = overview.roles;
  const roleAccess = (code: string, section: SectionId): AccessLevel =>
    (draft[code]?.[section] ?? roles.find((r) => r.code === code)?.access[section] ?? 'NONE') as AccessLevel;
  const dirtyRoles = Object.keys(draft).filter((code) =>
    SECTIONS.some((s) => draft[code]?.[s.id] !== undefined && draft[code]?.[s.id] !== (roles.find((r) => r.code === code)?.access[s.id] || 'NONE'))
  );

  const saveRoles = async () => {
    setSaving(true);
    try {
      for (const code of dirtyRoles) {
        const role = roles.find((r) => r.code === code)!;
        const access = Object.fromEntries(SECTIONS.map((s) => [s.id, roleAccess(code, s.id)]));
        await ManagerApi.updateRoleAccess(role.code, access);
      }
      success(`Default access saved for ${dirtyRoles.map((c) => roleDisplayName(c)).join(', ')}.`);
      setDraft({});
      setConfirmSave(false);
      onChanged();
    } catch (err: any) {
      error(err.message || 'Unable to save role access.');
    } finally {
      setSaving(false);
    }
  };

  const selectedUser = overview.users.find((u) => u.id === userId) || null;
  useEffect(() => {
    setUserDraft(selectedUser ? { ...(selectedUser.sectionAccess || {}) } : null);
  }, [userId, overview]);

  const templates = useMemo(() => roles.map((r) => ({ id: r.code as StaffRoleCode, access: r.access })), [roles]);
  const saveUser = async (reset = false) => {
    if (!selectedUser || !userDraft) return;
    setSaving(true);
    try {
      await ManagerApi.updateEmployee(selectedUser.id, { sectionAccess: reset || Object.keys(userDraft).length === 0 ? null : userDraft });
      success(reset ? 'Custom access removed; role defaults apply.' : `Access saved for ${selectedUser.firstName}.`);
      onChanged();
    } catch (err: any) {
      error(err.message || 'Unable to save user access.');
    } finally {
      setSaving(false);
    }
  };

  const userEditable =
    !!selectedUser && canEdit && selectedUser.id !== currentUserId && !(selectedUser.role === 'ADMIN' && currentRole !== 'ADMIN') && effectivePrivilege(selectedUser) === 'USER';

  return (
    <div className="space-y-3">
      <div className="bg-white rounded-2xl border border-[var(--border-subtle)] p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex gap-1 p-1 rounded-xl bg-stone-100/80 w-fit" role="tablist" aria-label="Access control view">
          {(['ROLES', 'USER'] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={mode === m}
              onClick={() => setMode(m)}
              className={`px-3 min-h-9 rounded-lg text-xs font-semibold cursor-pointer ${mode === m ? 'bg-white text-[var(--brand-text)] shadow-sm' : 'text-stone-600 hover:text-[var(--brand-text)]'}`}
            >
              {m === 'ROLES' ? 'By role' : 'By user'}
            </button>
          ))}
        </div>
        <p className="text-[11px] text-stone-500 max-w-xl">
          <strong>Full Access</strong> view and change · <strong>View Access</strong> read only · <strong>No Access</strong> hidden and blocked. Super Admins always have Full Access.
        </p>
      </div>

      {mode === 'ROLES' ? (
        <div className="bg-white rounded-2xl border border-[var(--border-subtle)] overflow-hidden">
          <div className="overflow-x-auto max-h-[65vh]">
            <table className="w-full text-left min-w-[760px]">
              <thead className="bg-stone-50 border-b border-stone-200 sticky top-0 z-10">
                <tr>
                  <th className="px-4 text-[11px] uppercase tracking-wider text-stone-500 sticky left-0 bg-stone-50 z-20 min-w-[200px]">Section</th>
                  {roles.map((r) => (
                    <th key={r.code} className="px-2 text-[11px] uppercase tracking-wider text-stone-500">
                      <span className="block">{r.name}</span>
                      <span className="block normal-case tracking-normal font-normal text-[10px] text-stone-400">{r.defaultPrivilege === 'SUPER_ADMIN' ? 'Super Admin by default' : 'User'}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="text-xs">
                {GROUPS.map((group) => (
                  <React.Fragment key={group}>
                    <tr className="bg-[var(--surface-muted)]">
                      <td colSpan={roles.length + 1} className="px-4 text-[10px] font-bold uppercase tracking-[0.18em] text-stone-400 sticky left-0">{group}</td>
                    </tr>
                    {SECTIONS.filter((s) => s.group === group).map((s) => (
                      <tr key={s.id} className="border-b border-stone-100">
                        <td className="px-4 py-1.5 sticky left-0 bg-white z-10">
                          <span className="block font-semibold text-stone-800">{s.label}</span>
                          <span className="block text-[10.5px] text-stone-400">{s.description}</span>
                        </td>
                        {roles.map((r) => {
                          const level = roleAccess(r.code, s.id);
                          const changed = draft[r.code]?.[s.id] !== undefined && draft[r.code]?.[s.id] !== (r.access[s.id] || 'NONE');
                          return (
                            <td key={r.code} className={`px-2 py-1.5 ${changed ? 'bg-amber-50/70' : ''}`}>
                              {canEdit ? (
                                <select
                                  aria-label={`${r.name} — ${s.label}`}
                                  value={level}
                                  onChange={(e) => setDraft((d) => ({ ...d, [r.code]: { ...(d[r.code] || {}), [s.id]: e.target.value as AccessLevel } }))}
                                  className={selectCls}
                                >
                                  <option value="FULL">Full Access</option>
                                  <option value="VIEW">View Access</option>
                                  <option value="NONE">No Access</option>
                                </select>
                              ) : (
                                <AccessLevelChip level={level} />
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
          {canEdit && (
            <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-t border-stone-200 bg-stone-50/60">
              <span className="text-[11px] text-stone-500">
                {dirtyRoles.length ? `Unsaved changes for ${dirtyRoles.map((c) => roleDisplayName(c)).join(', ')}` : 'Role templates apply to users with the User privilege who have no custom override.'}
              </span>
              <div className="flex gap-2">
                <button type="button" className="btn btn-secondary" disabled={!dirtyRoles.length || saving} onClick={() => setDraft({})}>Discard</button>
                <button type="button" className="btn btn-primary" disabled={!dirtyRoles.length || saving} onClick={() => setConfirmSave(true)}>Save changes</button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-[var(--border-subtle)] p-4 space-y-3">
          <label className="block space-y-1 max-w-md">
            <span className="text-xs font-bold text-stone-700">User</span>
            <select value={userId} onChange={(e) => setUserId(e.target.value)} className={selectCls + ' !text-xs !py-2'}>
              <option value="">Select a user…</option>
              {overview.users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.firstName} {u.lastName} — {roleDisplayName(u.role)} ({effectivePrivilege(u) === 'SUPER_ADMIN' ? 'Super Admin' : 'User'})
                </option>
              ))}
            </select>
          </label>

          {selectedUser && userDraft && (
            <>
              {effectivePrivilege(selectedUser) === 'SUPER_ADMIN' && (
                <p className="text-[11.5px] text-stone-600 bg-[var(--brand-soft)] border border-[var(--brand-border)] rounded-lg px-3 py-2">
                  {selectedUser.firstName} is a Super Admin and has Full Access everywhere. Revoke Super Admin in the Privileges tab to limit access.
                </p>
              )}
              <div className="overflow-x-auto rounded-lg border border-stone-200">
                <table className="w-full text-left min-w-[560px]">
                  <thead className="bg-stone-50 text-[11px] uppercase tracking-wider text-stone-500">
                    <tr>
                      <th className="px-3">Section</th>
                      <th className="px-3">Effective</th>
                      <th className="px-3">Source</th>
                      <th className="px-3">Override</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100 text-xs">
                    {SECTIONS.map((s) => {
                      const preview = { ...selectedUser, sectionAccess: userDraft };
                      const level = resolveSectionAccess(preview, s.id, templates);
                      const source = accessSource(preview, s.id);
                      return (
                        <tr key={s.id}>
                          <td className="px-3 py-1.5 font-semibold text-stone-800">{s.label}</td>
                          <td className="px-3"><AccessLevelChip level={level} /></td>
                          <td className="px-3 text-[11px]">
                            <span className={source === 'CUSTOM' ? 'font-bold text-[var(--brand-text)]' : 'text-stone-500'}>
                              {source === 'SUPER_ADMIN' ? 'Super Admin' : source === 'CUSTOM' ? 'Custom' : 'Role default'}
                            </span>
                          </td>
                          <td className="px-3 py-1.5">
                            <select
                              aria-label={`${s.label} override`}
                              value={userDraft[s.id] || 'INHERIT'}
                              disabled={!userEditable}
                              onChange={(e) =>
                                setUserDraft((d) => {
                                  const next = { ...(d || {}) };
                                  if (e.target.value === 'INHERIT') delete next[s.id];
                                  else next[s.id] = e.target.value as AccessLevel;
                                  return next;
                                })
                              }
                              className={selectCls}
                            >
                              <option value="INHERIT">Inherit ({ACCESS_LABELS[(roles.find((r) => r.code === selectedUser.role)?.access[s.id] || 'NONE') as AccessLevel]})</option>
                              <option value="FULL">Full Access</option>
                              <option value="VIEW">View Access</option>
                              <option value="NONE">No Access</option>
                            </select>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {userEditable ? (
                <div className="flex flex-wrap justify-end gap-2">
                  <button type="button" className="btn btn-secondary" disabled={saving || !Object.keys(selectedUser.sectionAccess || {}).length} onClick={() => saveUser(true)}>
                    <RotateCcw className="w-3.5 h-3.5" /> Reset to role defaults
                  </button>
                  <button type="button" className="btn btn-primary" disabled={saving} onClick={() => saveUser(false)}>
                    {saving ? 'Saving…' : 'Save user access'}
                  </button>
                </div>
              ) : (
                <p className="text-[11px] text-stone-400 text-right">
                  {selectedUser.id === currentUserId ? 'You cannot change your own access.' : !canEdit ? 'Only a Super Admin can change access.' : effectivePrivilege(selectedUser) === 'SUPER_ADMIN' ? '' : 'View only'}
                </p>
              )}
            </>
          )}
        </div>
      )}

      {confirmSave && (
        <Modal isOpen={confirmSave} onClose={() => setConfirmSave(false)} title="Save role access changes?" maxWidth="max-w-md">
          <div className="space-y-4 text-sm text-stone-700">
            <p>
              Default access will change for <strong>{dirtyRoles.map((c) => roleDisplayName(c)).join(', ')}</strong>. Users with these roles and the User privilege
              are affected immediately, except sections where they have a custom override.
            </p>
            <div className="flex justify-end gap-2">
              <button type="button" className="btn btn-secondary" onClick={() => setConfirmSave(false)}>Cancel</button>
              <button type="button" className="btn btn-primary" disabled={saving} onClick={saveRoles}>{saving ? 'Saving…' : 'Save changes'}</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
