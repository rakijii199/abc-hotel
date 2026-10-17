/**
 * User Management: Users, Roles, Privileges and Access Control.
 * Tabs appear according to the signed-in user's section access; changes are
 * Super Admin only and are enforced again by the API.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { KeyRound, Layers, Loader2, RotateCcw, ShieldCheck, Users } from 'lucide-react';
import { AdminEmployeesView } from './AdminEmployeesView.tsx';
import { AccessLevelChip, PrivilegeChip } from './AccessEditor.tsx';
import { AccessOverview, ManagerApi } from '../../api/index.ts';
import { useAuth } from '../../context/AuthContext.tsx';
import { useToast } from '../../context/ToastContext.tsx';
import { Modal } from '../common/Footer.tsx';
import {
  ACCESS_LABELS,
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
      <div className="bg-white rounded-2xl border border-[var(--border-subtle)] p-4 sm:p-5 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h2 className="lux-display text-2xl text-stone-900 flex items-center gap-2">
            <Users className="w-5 h-5 text-amber-700" /> User Management
          </h2>
          <p className="text-xs text-stone-500 mt-0.5">Users, roles, privileges and section-level access in one place.</p>
        </div>
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
                className={`inline-flex items-center gap-1.5 px-3 min-h-9 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
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
        <div className="p-10 flex justify-center bg-white rounded-2xl border border-stone-200">
          <Loader2 className="w-6 h-6 animate-spin text-amber-700" />
        </div>
      )}
      {tab !== 'USERS' && loadError && (
        <p className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-sm text-rose-800" role="alert">{loadError}</p>
      )}

      {overview && tab === 'ROLES' && <RolesTab overview={overview} onEditAccess={() => setTab('ACCESS_CONTROL')} canEdit={isSuperAdmin && can('ACCESS_CONTROL', 'VIEW')} />}
      {overview && tab === 'PRIVILEGES' && <PrivilegesTab overview={overview} currentUserId={user?.id} currentRole={user?.role} canEdit={isSuperAdmin} onChanged={load} />}
      {overview && tab === 'ACCESS_CONTROL' && <AccessControlTab overview={overview} currentUserId={user?.id} currentRole={user?.role} canEdit={isSuperAdmin} onChanged={load} />}
    </div>
  );
};

/* ------------------------------- Roles ---------------------------------- */
const RolesTab: React.FC<{ overview: AccessOverview; canEdit: boolean; onEditAccess: () => void }> = ({ overview, canEdit, onEditAccess }) => (
  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
    {overview.roles.map((role) => {
      const members = overview.users.filter((u) => u.role === role.code);
      const full = SECTIONS.filter((s) => role.access[s.id] === 'FULL');
      const view = SECTIONS.filter((s) => role.access[s.id] === 'VIEW');
      return (
        <article key={role.code} className="bg-white rounded-2xl border border-[var(--border-subtle)] p-4 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="lux-display text-xl text-stone-900">{role.name}</h3>
              <p className="text-[11.5px] text-stone-500 leading-relaxed mt-0.5">{role.purpose}</p>
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400 whitespace-nowrap">{members.length} user{members.length === 1 ? '' : 's'}</span>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-stone-600">
            Default privilege: <PrivilegeChip privilege={role.defaultPrivilege} />
          </div>
          {role.defaultPrivilege === 'SUPER_ADMIN' ? (
            <p className="text-[11px] text-stone-600">Full administrative access to every section.</p>
          ) : (
            <div className="space-y-1.5 text-[11px]">
              <p><span className="font-semibold text-emerald-800">Full:</span> <span className="text-stone-600">{full.map((s) => s.label).join(', ') || '—'}</span></p>
              <p><span className="font-semibold text-sky-800">View:</span> <span className="text-stone-600">{view.map((s) => s.label).join(', ') || '—'}</span></p>
            </div>
          )}
          <div className="flex items-center justify-between pt-2 border-t border-stone-100">
            <span className="text-[10.5px] text-stone-400">{role.customized ? `Customised ${role.updatedAt ? new Date(role.updatedAt).toLocaleDateString() : ''}` : 'System defaults'}</span>
            {canEdit && role.defaultPrivilege === 'USER' && (
              <button type="button" onClick={onEditAccess} className="btn btn-secondary !min-h-8 !px-3 !text-[11px]">Edit default access</button>
            )}
          </div>
        </article>
      );
    })}
  </div>
);

/* ----------------------------- Privileges -------------------------------- */
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
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="bg-white rounded-2xl border border-[var(--border-subtle)] p-4 space-y-1.5">
          <PrivilegeChip privilege="SUPER_ADMIN" />
          <p className="text-[12px] text-stone-700 leading-relaxed">
            Manages users, assigns roles, configures access and application settings. Full access to every section. Default for Owner and Manager.
          </p>
        </div>
        <div className="bg-white rounded-2xl border border-[var(--border-subtle)] p-4 space-y-1.5">
          <PrivilegeChip privilege="USER" />
          <p className="text-[12px] text-stone-700 leading-relaxed">
            Uses only the sections and actions their role and assigned access allow; cannot manage users, roles or access. Default for Staff, Kitchen Staff and Delivery Staff.
          </p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-[var(--border-subtle)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[640px]">
            <thead className="bg-stone-50 border-b border-stone-200 text-[11px] uppercase tracking-wider text-stone-500">
              <tr>
                <th className="px-4">User</th>
                <th className="px-4">Role</th>
                <th className="px-4">Privilege</th>
                <th className="px-4">Source</th>
                <th className="px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 text-xs">
              {overview.users.map((u) => {
                const priv = effectivePrivilege(u) || 'USER';
                const isSelf = u.id === currentUserId;
                const ownerLocked = u.role === 'ADMIN' && currentRole !== 'ADMIN';
                return (
                  <tr key={u.id}>
                    <td className="px-4 font-semibold text-stone-900">{u.firstName} {u.lastName}{isSelf && <span className="ml-1 text-stone-400 font-normal">(you)</span>}</td>
                    <td className="px-4 text-stone-700">{roleDisplayName(u.role)}</td>
                    <td className="px-4"><PrivilegeChip privilege={priv} /></td>
                    <td className="px-4 text-stone-500">{u.privilege ? 'Assigned' : 'Role default'}</td>
                    <td className="px-4 text-right">
                      {canEdit && !isSelf && !ownerLocked ? (
                        <button
                          type="button"
                          onClick={() => setConfirm({ user: u, to: priv === 'SUPER_ADMIN' ? 'USER' : 'SUPER_ADMIN' })}
                          className={`btn !min-h-8 !px-3 !text-[11px] ${priv === 'SUPER_ADMIN' ? 'btn-secondary' : 'btn-primary'}`}
                        >
                          {priv === 'SUPER_ADMIN' ? 'Revoke Super Admin' : 'Grant Super Admin'}
                        </button>
                      ) : (
                        <span className="text-[10.5px] text-stone-400">{isSelf ? 'Cannot change your own' : 'View only'}</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

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
