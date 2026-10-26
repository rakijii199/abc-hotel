/**
 * Employee & Staff Management View
 * Users table (search, filter, sort, export) + add / edit / reset / remove dialogs
 * Roles: Owner, Manager, Staff, Kitchen Staff, Delivery Staff
 */
import React, { useState, useEffect } from 'react';
import {
  Users,
  UserPlus,
  Search,
  Shield,
  ChefHat,
  Truck,
  Briefcase,
  Key,
  Edit2,
  Trash2,
  AlertCircle,
  RefreshCw,
  Phone,
  Lock,
  Eye,
  EyeOff
} from 'lucide-react';
import { SafeUser, UserRole, UserStatus } from '../../types/index.ts';
import { ManagerApi } from '../../api/index.ts';
import { useAuth } from '../../context/AuthContext.tsx';
import { useToast } from '../../context/ToastContext.tsx';
import { AccessEditor, RoleTemplates } from './AccessEditor.tsx';
import { Chip, DataTable, StatusPill, rowIconBtn } from './DataTable.tsx';
import {
  AccessLevel,
  PrivilegeType,
  ROLE_DEFINITIONS,
  SectionId,
  StaffRoleCode,
  effectivePrivilege,
  roleDisplayName
} from '../../../shared/accessControl.ts';

const filterSelect =
  'w-full h-9 px-2.5 bg-white border border-stone-200 rounded-lg text-xs text-stone-800 focus:outline-hidden focus:border-[var(--brand)] cursor-pointer';

const roleDefault = (role: string): PrivilegeType =>
  ROLE_DEFINITIONS.find((r) => r.code === role)?.defaultPrivilege || 'USER';

interface AdminEmployeesViewProps {
  onRefreshStats?: () => void;
}


/** Random temporary password meeting the server policy (upper, lower, digit, symbol). */
function generateTemporaryPassword(): string {
  const sets = ['ABCDEFGHJKLMNPQRSTUVWXYZ', 'abcdefghijkmnpqrstuvwxyz', '23456789', '@#$%&*!?'];
  const all = sets.join('');
  const pick = (chars: string) => chars[crypto.getRandomValues(new Uint32Array(1))[0] % chars.length];
  const chars = [...sets.map(pick), ...Array.from({ length: 8 }, () => pick(all))];
  for (let i = chars.length - 1; i > 0; i--) {
    const j = crypto.getRandomValues(new Uint32Array(1))[0] % (i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}
export const AdminEmployeesView: React.FC<AdminEmployeesViewProps> = ({ onRefreshStats }) => {
  const { user: currentUser, isSuperAdmin } = useAuth();
  const isOwner = currentUser?.role === 'ADMIN';
  // Role templates (role defaults, including any Access Control customisation)
  const [roleTemplates, setRoleTemplates] = useState<RoleTemplates>({});
  useEffect(() => {
    ManagerApi.getAccessOverview()
      .then((o) => setRoleTemplates(Object.fromEntries(o.roles.map((r) => [r.code, r.access])) as RoleTemplates))
      .catch(() => setRoleTemplates({}));
  }, []);
  const { error, success, info } = useToast();

  const [employees, setEmployees] = useState<SafeUser[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  // Filters
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Modals state
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<SafeUser | null>(null);
  const [resetPasswordEmployee, setResetPasswordEmployee] = useState<SafeUser | null>(null);
  const [deletingEmployee, setDeletingEmployee] = useState<SafeUser | null>(null);

  // Add Employee Form State
  const [newFirstName, setNewFirstName] = useState('');
  const [newLastName, setNewLastName] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('STAFF');
  const [newPrivilege, setNewPrivilege] = useState<PrivilegeType>('USER');
  const [newPrivilegeTouched, setNewPrivilegeTouched] = useState(false);
  const [newOverrides, setNewOverrides] = useState<Partial<Record<SectionId, AccessLevel>>>({});
  const [newPassword, setNewPassword] = useState('');
  const [newConfirmPassword, setNewConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submittingAdd, setSubmittingAdd] = useState(false);

  // Edit Employee Form State
  const [editFirstName, setEditFirstName] = useState('');
  const [editLastName, setEditLastName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editRole, setEditRole] = useState<UserRole>('STAFF');
  const [editPrivilege, setEditPrivilege] = useState<PrivilegeType>('USER');
  const [editPrivilegeTouched, setEditPrivilegeTouched] = useState(false);
  const [editOverrides, setEditOverrides] = useState<Partial<Record<SectionId, AccessLevel>>>({});
  const [editStatus, setEditStatus] = useState<UserStatus>('ACTIVE');
  const [submittingEdit, setSubmittingEdit] = useState(false);

  // Reset Password State
  const [newResetPassword, setNewResetPassword] = useState('');
  const [confirmResetPassword, setConfirmResetPassword] = useState('');
  const [submittingReset, setSubmittingReset] = useState(false);

  const fetchEmployeesData = async (isBackground = false) => {
    if (!isBackground) setRefreshing(true);
    try {
      const list = await ManagerApi.getEmployees();

      setEmployees(list);
    } catch (err: any) {
      error(err.message || 'Failed to load employees.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchEmployeesData();
  }, []);

  const filteredEmployees = employees.filter(
    (emp) => (roleFilter === 'ALL' || emp.role === roleFilter) && (statusFilter === 'ALL' || emp.status === statusFilter)
  );
  const activeFilterCount = (roleFilter !== 'ALL' ? 1 : 0) + (statusFilter !== 'ALL' ? 1 : 0);

  useEffect(() => {
    if (!newPrivilegeTouched) setNewPrivilege(roleDefault(newRole));
  }, [newRole, newPrivilegeTouched]);

  // Handle Add Employee Submit
  const handleAddEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFirstName.trim() || !newLastName.trim() || !newEmail.trim() || !newPhone.trim()) {
      error('Please fill in all required fields.');
      return;
    }
    if (newPassword !== newConfirmPassword) {
      error('Passwords do not match.');
      return;
    }
    if (newPassword.length < 8) {
      error('Password must be at least 8 characters long.');
      return;
    }

    setSubmittingAdd(true);
    try {
      await ManagerApi.createEmployee({
        firstName: newFirstName.trim(),
        lastName: newLastName.trim(),
        username: newUsername.trim().toLowerCase(),
        email: newEmail.trim().toLowerCase(),
        phone: newPhone.trim(),
        role: newRole,
        password: newPassword,
        confirmPassword: newConfirmPassword,
        status: 'ACTIVE',
        privilege: newPrivilege,
        ...(newPrivilege === 'USER' && Object.keys(newOverrides).length ? { sectionAccess: newOverrides } : {})
      });

      success(`Employee "${newFirstName} ${newLastName}" added successfully.`);
      setShowAddModal(false);
      // Reset form
      setNewFirstName('');
      setNewLastName('');
      setNewUsername('');
      setNewEmail('');
      setNewPhone('');
      setNewRole('STAFF');
      setNewPrivilege('USER');
      setNewPrivilegeTouched(false);
      setNewOverrides({});
      setNewPassword('');
      setNewConfirmPassword('');
      fetchEmployeesData();
      if (onRefreshStats) onRefreshStats();
    } catch (err: any) {
      error(err.message || 'Failed to create employee.');
    } finally {
      setSubmittingAdd(false);
    }
  };

  // Open Edit Modal
  const openEditModal = (emp: SafeUser) => {
    setEditingEmployee(emp);
    setEditFirstName(emp.firstName);
    setEditLastName(emp.lastName);
    setEditPhone(emp.phone);
    // Keep the real role (Owner accounts used to be shown — and saved — as Staff).
    setEditRole(emp.role);
    setEditStatus(emp.status);
    setEditPrivilege(effectivePrivilege(emp) || 'USER');
    // An explicitly stored privilege counts as a deliberate choice.
    setEditPrivilegeTouched(!!emp.privilege);
    setEditOverrides({ ...(emp.sectionAccess || {}) });
  };

  // Handle Edit Submit
  const handleEditEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEmployee) return;

    setSubmittingEdit(true);
    try {
      await ManagerApi.updateEmployee(editingEmployee.id, {
        firstName: editFirstName.trim(),
        lastName: editLastName.trim(),
        phone: editPhone.trim(),
        role: editRole,
        status: editStatus,
        privilege: editPrivilege,
        sectionAccess: editPrivilege === 'USER' && Object.keys(editOverrides).length ? editOverrides : null
      });

      success(`Employee updated successfully.`);
      setEditingEmployee(null);
      fetchEmployeesData();
      if (onRefreshStats) onRefreshStats();
    } catch (err: any) {
      error(err.message || 'Failed to update employee.');
    } finally {
      setSubmittingEdit(false);
    }
  };

  const handleEditRoleChange = (role: UserRole) => {
    setEditRole(role);
    if (!editPrivilegeTouched) setEditPrivilege(roleDefault(role));
  };

  // Handle Status Toggle (Activate / Deactivate)
  const handleToggleStatus = async (emp: SafeUser) => {
    if (emp.id === currentUser?.id) {
      error('You cannot change the status of your own account.');
      return;
    }

    const targetStatus = emp.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    try {
      await ManagerApi.updateStatus(emp.id, targetStatus);
      success(`${emp.firstName} ${emp.lastName} marked as ${targetStatus.toLowerCase()}.`);
      fetchEmployeesData(true);
      if (onRefreshStats) onRefreshStats();
    } catch (err: any) {
      error(err.message || 'Failed to change employee status.');
    }
  };

  // Handle Reset Password Submit
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetPasswordEmployee) return;

    if (newResetPassword !== confirmResetPassword) {
      error('Passwords do not match.');
      return;
    }
    if (newResetPassword.length < 8) {
      error('Password must be at least 8 characters long.');
      return;
    }

    setSubmittingReset(true);
    try {
      await ManagerApi.resetPassword(resetPasswordEmployee.id, {
        newPassword: newResetPassword,
        confirmNewPassword: confirmResetPassword
      });

      success(`Password reset for ${resetPasswordEmployee.firstName} ${resetPasswordEmployee.lastName}.`);
      setResetPasswordEmployee(null);
      setNewResetPassword('');
      setConfirmResetPassword('');
    } catch (err: any) {
      error(err.message || 'Failed to reset password.');
    } finally {
      setSubmittingReset(false);
    }
  };

  // Handle Delete / Remove Employee
  const handleDeleteEmployee = async () => {
    if (!deletingEmployee) return;
    if (deletingEmployee.id === currentUser?.id) {
      error('You cannot remove your own account.');
      return;
    }

    try {
      await ManagerApi.deleteEmployee(deletingEmployee.id, 'Removed by Manager');
      success(`Employee "${deletingEmployee.firstName} ${deletingEmployee.lastName}" removed.`);
      setDeletingEmployee(null);
      fetchEmployeesData();
      if (onRefreshStats) onRefreshStats();
    } catch (err: any) {
      error(err.message || 'Failed to remove employee.');
    }
  };

  return (
    <div className="space-y-4">
      <DataTable<SafeUser>
        title="Users"
        rows={filteredEmployees}
        rowKey={(emp) => emp.id}
        loading={loading}
        minWidth={920}
        searchText={(emp) => [emp.firstName, emp.lastName, emp.username, emp.email, emp.phone, roleDisplayName(emp.role)].join(' ')}
        searchPlaceholder="Search name, username, email, mobile"
        filters={
          <>
            <label className="block space-y-1">
              <span className="text-[11px] font-semibold text-stone-500">Role</span>
              <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className={filterSelect}>
                <option value="ALL">All roles</option>
                {ROLE_DEFINITIONS.map((r) => (
                  <option key={r.code} value={r.code}>{r.name}</option>
                ))}
              </select>
            </label>
            <label className="block space-y-1">
              <span className="text-[11px] font-semibold text-stone-500">Status</span>
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={filterSelect}>
                <option value="ALL">All statuses</option>
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
              </select>
            </label>
          </>
        }
        activeFilterCount={activeFilterCount}
        onClearFilters={() => {
          setRoleFilter('ALL');
          setStatusFilter('ALL');
        }}
        onRefresh={() => fetchEmployeesData()}
        refreshing={refreshing}
        exportName="users"
        exportRow={(emp) => ({
          Name: `${emp.firstName} ${emp.lastName}`,
          Username: emp.username || '',
          Email: emp.email,
          Mobile: emp.phone || '',
          Role: roleDisplayName(emp.role),
          Privilege: effectivePrivilege(emp) === 'SUPER_ADMIN' ? 'Super Admin' : 'User',
          Status: emp.status === 'ACTIVE' ? 'Active' : 'Inactive'
        })}
        primaryAction={{
          label: 'Add user',
          onClick: () => setShowAddModal(true),
          disabled: !isSuperAdmin,
          title: isSuperAdmin ? 'Add a new user' : 'Only a Super Admin can add users'
        }}
        emptyText="No users match your search or filters."
        rowClassName={(emp) => (emp.status === 'ACTIVE' ? '' : 'opacity-70')}
        columns={[
          {
            key: 'name',
            header: 'Name',
            sortValue: (emp) => `${emp.firstName} ${emp.lastName}`.toLowerCase(),
            render: (emp) => (
              <span className="font-semibold text-[var(--brand-text)] whitespace-nowrap">
                {emp.firstName} {emp.lastName}
                {emp.id === currentUser?.id && <span className="ml-1 font-normal text-stone-400">(you)</span>}
              </span>
            )
          },
          {
            key: 'username',
            header: 'Username',
            sortValue: (emp) => (emp.username || '').toLowerCase(),
            render: (emp) => <span className="text-stone-600">@{emp.username || emp.email.split('@')[0]}</span>
          },
          { key: 'email', header: 'Email', sortValue: (emp) => emp.email.toLowerCase(), render: (emp) => emp.email },
          { key: 'phone', header: 'Mobile', render: (emp) => <span className="whitespace-nowrap">{emp.phone || '—'}</span> },
          {
            key: 'role',
            header: 'Role',
            sortValue: (emp) => roleDisplayName(emp.role),
            render: (emp) => <Chip>{roleDisplayName(emp.role)}</Chip>
          },
          {
            key: 'privilege',
            header: 'Privilege',
            sortValue: (emp) => effectivePrivilege(emp) || '',
            render: (emp) => (
              <span className="inline-flex items-center gap-1.5">
                <Chip tone={effectivePrivilege(emp) === 'SUPER_ADMIN' ? 'brand' : 'muted'}>
                  {effectivePrivilege(emp) === 'SUPER_ADMIN' ? 'Super Admin' : 'User'}
                </Chip>
                {emp.sectionAccess && Object.keys(emp.sectionAccess).length > 0 && effectivePrivilege(emp) === 'USER' && (
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--brand)]" title="Has custom section access" />
                )}
              </span>
            )
          },
          {
            key: 'status',
            header: 'Status',
            sortValue: (emp) => emp.status,
            render: (emp) => {
              const locked = emp.id === currentUser?.id || !isSuperAdmin || (emp.role === 'ADMIN' && !isOwner);
              return (
                <StatusPill
                  active={emp.status === 'ACTIVE'}
                  onClick={locked ? undefined : () => handleToggleStatus(emp)}
                  title="Click to activate / deactivate"
                />
              );
            }
          }
        ]}
        rowActions={(emp) => {
          if (!isSuperAdmin || (emp.role === 'ADMIN' && !isOwner)) return <span className="text-[11px] text-stone-400">View only</span>;
          return (
            <span className="inline-flex items-center gap-0.5">
              <button type="button" onClick={() => openEditModal(emp)} className={rowIconBtn} title="Edit user" aria-label={`Edit ${emp.firstName}`}>
                <Edit2 className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setResetPasswordEmployee(emp);
                  setNewResetPassword('');
                  setConfirmResetPassword('');
                }}
                className={rowIconBtn}
                title="Reset password"
                aria-label={`Reset password for ${emp.firstName}`}
              >
                <Key className="w-3.5 h-3.5" />
              </button>
              {emp.id !== currentUser?.id && (
                <button
                  type="button"
                  onClick={() => setDeletingEmployee(emp)}
                  className={`${rowIconBtn} hover:!text-rose-700 hover:!bg-rose-50`}
                  title="Remove user"
                  aria-label={`Remove ${emp.firstName}`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </span>
          );
        }}
      />

      {/* ========================================================================= */}
      {/* MODAL 1: ADD NEW EMPLOYEE */}
      {/* ========================================================================= */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/35 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-xl w-full p-4 sm:p-6 shadow-[var(--shadow-float)] border border-[var(--border-subtle)] space-y-4 max-h-[90vh] animate-in fade-in zoom-in-95 overflow-y-auto">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <div>
                <h3 className="font-serif font-bold text-xl text-stone-900">
                  Add New Employee
                </h3>
                <p className="text-xs text-stone-500">Create login credentials and assign a role.</p>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="w-8 h-8 rounded-full bg-stone-100 hover:bg-stone-200 flex items-center justify-center text-stone-500 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddEmployee} className="space-y-3.5">
              {/* Names */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-stone-700">First Name *</label>
                  <input
                    type="text"
                    required
                    value={newFirstName}
                    onChange={(e) => setNewFirstName(e.target.value)}
                    placeholder="e.g. Marco"
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-900 focus:border-amber-600 focus:bg-white"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-stone-700">Last Name *</label>
                  <input
                    type="text"
                    required
                    value={newLastName}
                    onChange={(e) => setNewLastName(e.target.value)}
                    placeholder="e.g. Pierre"
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-900 focus:border-amber-600 focus:bg-white"
                  />
                </div>
              </div>

              {/* Username & Email */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-stone-700">Username *</label>
                  <div className="relative">
                    <span className="text-stone-400 text-xs font-mono absolute left-3 top-1/2 -translate-y-1/2">
                      @
                    </span>
                    <input
                      type="text"
                      required
                      value={newUsername}
                      onChange={(e) =>
                        setNewUsername(e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, ''))
                      }
                      placeholder="chef_marco"
                      className="w-full pl-7 pr-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-mono text-stone-900 focus:border-amber-600 focus:bg-white"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-stone-700">Work Email *</label>
                  <input
                    type="email"
                    required
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="marco@hotel.com"
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-900 focus:border-amber-600 focus:bg-white"
                  />
                </div>
              </div>

              {/* Mobile Phone */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-stone-700">Mobile Phone *</label>
                <input
                  type="tel"
                  required
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  placeholder="+91 9876543210"
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-mono text-stone-900 focus:border-amber-600 focus:bg-white"
                />
              </div>

              {/* Role Selection */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-stone-700">Role *</label>
                <div className="grid grid-cols-2 gap-2">
                  {isOwner && (
                    <label
                      onClick={() => setNewRole('ADMIN')}
                      className={`p-2.5 rounded-xl border flex items-center gap-2 cursor-pointer transition-all ${
                        newRole === 'ADMIN'
                          ? 'border-amber-600 bg-amber-50/70 ring-1 ring-amber-500'
                          : 'border-stone-200 hover:bg-stone-50'
                      }`}
                    >
                      <Shield className="w-4 h-4 text-amber-700 shrink-0" />
                      <span className="text-xs font-bold text-stone-900">Owner</span>
                    </label>
                  )}
                  <label
                    onClick={() => setNewRole('MANAGER')}
                    className={`p-2.5 rounded-xl border flex items-center gap-2 cursor-pointer transition-all ${
                      newRole === 'MANAGER'
                        ? 'border-amber-600 bg-amber-50/70 ring-1 ring-amber-500'
                        : 'border-stone-200 hover:bg-stone-50'
                    }`}
                  >
                    <Shield className="w-4 h-4 text-amber-700 shrink-0" />
                    <span className="text-xs font-bold text-stone-900">Manager</span>
                  </label>

                  <label
                    onClick={() => setNewRole('STAFF')}
                    className={`p-2.5 rounded-xl border flex items-center gap-2 cursor-pointer transition-all ${
                      newRole === 'STAFF'
                        ? 'border-amber-600 bg-amber-50/70 ring-1 ring-amber-500'
                        : 'border-stone-200 hover:bg-stone-50'
                    }`}
                  >
                    <Briefcase className="w-4 h-4 text-amber-700 shrink-0" />
                    <span className="text-xs font-bold text-stone-900">Staff</span>
                  </label>

                  <label
                    onClick={() => setNewRole('KITCHEN')}
                    className={`p-2.5 rounded-xl border flex items-center gap-2 cursor-pointer transition-all ${
                      newRole === 'KITCHEN'
                        ? 'border-amber-600 bg-amber-50/70 ring-1 ring-amber-500'
                        : 'border-stone-200 hover:bg-stone-50'
                    }`}
                  >
                    <ChefHat className="w-4 h-4 text-amber-700 shrink-0" />
                    <span className="text-xs font-bold text-stone-900">Kitchen Staff</span>
                  </label>

                  <label
                    onClick={() => setNewRole('DELIVERY')}
                    className={`p-2.5 rounded-xl border flex items-center gap-2 cursor-pointer transition-all ${
                      newRole === 'DELIVERY'
                        ? 'border-amber-600 bg-amber-50/70 ring-1 ring-amber-500'
                        : 'border-stone-200 hover:bg-stone-50'
                    }`}
                  >
                    <Truck className="w-4 h-4 text-amber-700 shrink-0" />
                    <span className="text-xs font-bold text-stone-900">Delivery Staff</span>
                  </label>
                </div>
                <p className="text-[10.5px] text-stone-500 pt-0.5">{ROLE_DEFINITIONS.find((r) => r.code === newRole)?.purpose}</p>
              </div>

              {/* Privilege & section access (defaults from the role; adjustable) */}
              <AccessEditor
                role={newRole as StaffRoleCode}
                privilege={newPrivilege}
                onPrivilegeChange={(p) => {
                  setNewPrivilege(p);
                  setNewPrivilegeTouched(true);
                }}
                overrides={newOverrides}
                onOverridesChange={setNewOverrides}
                templates={roleTemplates}
                editable={isSuperAdmin}
              />

              {/* Password */}
              <div className="p-3 bg-stone-50 rounded-xl border border-stone-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-stone-800 flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-stone-500" /> Password
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const generated = generateTemporaryPassword();
                      setNewPassword(generated);
                      setNewConfirmPassword(generated);
                      info(`Temporary password: ${generated} — share it securely with the employee.`);
                    }}
                    className="text-[10px] font-bold text-amber-800 hover:underline cursor-pointer"
                  >
                    Generate Strong Password
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter password"
                    className="w-full px-3 py-2 bg-white border border-stone-200 rounded-xl text-xs font-mono text-stone-900 focus:border-amber-600"
                  />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={newConfirmPassword}
                    onChange={(e) => setNewConfirmPassword(e.target.value)}
                    placeholder="Confirm password"
                    className="w-full px-3 py-2 bg-white border border-stone-200 rounded-xl text-xs font-mono text-stone-900 focus:border-amber-600"
                  />
                </div>
                <div className="flex items-center justify-between pt-0.5">
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-[10px] text-stone-500 hover:text-stone-800 flex items-center gap-1 cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                    {showPassword ? 'Hide' : 'Show'}
                  </button>
                  <span className="text-[10px] text-stone-400">Min. 8 characters</span>
                </div>
              </div>

              {/* Buttons */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl border border-stone-200 text-stone-600 hover:bg-stone-100 text-xs font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingAdd}
                  className="px-5 py-2 rounded-xl bg-amber-700 hover:bg-amber-800 disabled:opacity-50 text-white text-xs font-bold shadow-xs cursor-pointer flex items-center gap-1.5"
                >
                  {submittingAdd ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <UserPlus className="w-3.5 h-3.5" />}
                  <span>Save Employee</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: EDIT EMPLOYEE DETAILS */}
      {/* ========================================================================= */}
      {editingEmployee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/35 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-xl w-full p-4 sm:p-6 shadow-[var(--shadow-float)] border border-[var(--border-subtle)] space-y-4 max-h-[90vh] animate-in fade-in zoom-in-95 overflow-y-auto">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <div>
                <h3 className="font-serif font-bold text-xl text-stone-900">
                  Edit Employee
                </h3>
                <p className="text-xs text-stone-500">{editingEmployee.firstName} {editingEmployee.lastName}</p>
              </div>
              <button
                onClick={() => setEditingEmployee(null)}
                className="w-8 h-8 rounded-full bg-stone-100 hover:bg-stone-200 flex items-center justify-center text-stone-500 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleEditEmployee} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-stone-700">First Name</label>
                  <input
                    type="text"
                    required
                    value={editFirstName}
                    onChange={(e) => setEditFirstName(e.target.value)}
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-900 focus:border-amber-600"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-stone-700">Last Name</label>
                  <input
                    type="text"
                    required
                    value={editLastName}
                    onChange={(e) => setEditLastName(e.target.value)}
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-900 focus:border-amber-600"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-stone-700">Mobile Phone</label>
                <input
                  type="tel"
                  required
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-mono text-stone-900 focus:border-amber-600"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-stone-700">Role</label>
                <select
                  value={editRole}
                  onChange={(e) => handleEditRoleChange(e.target.value as UserRole)}
                  disabled={editingEmployee.id === currentUser?.id}
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-medium text-stone-900 focus:border-amber-600 disabled:opacity-60"
                >
                  {(isOwner || editRole === 'ADMIN') && <option value="ADMIN">Owner</option>}
                  <option value="MANAGER">Manager</option>
                  <option value="STAFF">Staff</option>
                  <option value="KITCHEN">Kitchen Staff</option>
                  <option value="DELIVERY">Delivery Staff</option>
                </select>
                {editingEmployee.id === currentUser?.id && (
                  <p className="text-[10.5px] text-stone-500">You cannot change your own role, privilege or access.</p>
                )}
              </div>

              <AccessEditor
                role={editRole as StaffRoleCode}
                privilege={editPrivilege}
                onPrivilegeChange={(p) => {
                  setEditPrivilege(p);
                  setEditPrivilegeTouched(true);
                }}
                overrides={editOverrides}
                onOverridesChange={setEditOverrides}
                templates={roleTemplates}
                editable={isSuperAdmin && editingEmployee.id !== currentUser?.id}
              />

              <div className="space-y-1">
                <label className="text-xs font-bold text-stone-700">Status</label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value as UserStatus)}
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-medium text-stone-900 focus:border-amber-600"
                >
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setEditingEmployee(null)}
                  className="px-4 py-2 rounded-xl border border-stone-200 text-stone-600 hover:bg-stone-100 text-xs font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingEdit}
                  className="px-5 py-2 rounded-xl bg-amber-700 hover:bg-amber-800 disabled:opacity-50 text-white text-xs font-bold shadow-xs cursor-pointer flex items-center gap-1.5"
                >
                  {submittingEdit ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : null}
                  <span>Save Changes</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: RESET PASSWORD */}
      {/* ========================================================================= */}
      {resetPasswordEmployee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/35 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-stone-200 space-y-4">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <div className="flex items-center gap-2 text-amber-800">
                <Key className="w-5 h-5 text-amber-700" />
                <h3 className="font-serif font-bold text-lg text-stone-900">
                  Reset Password
                </h3>
              </div>
              <button
                onClick={() => setResetPasswordEmployee(null)}
                className="w-7 h-7 rounded-full bg-stone-100 hover:bg-stone-200 flex items-center justify-center text-stone-500 cursor-pointer text-xs"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-stone-600">
              Set a new password for{' '}
              <strong className="text-stone-900">
                {resetPasswordEmployee.firstName} {resetPasswordEmployee.lastName}
              </strong>.
            </p>

            <form onSubmit={handleResetPassword} className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-bold text-stone-700">New Password</label>
                <input
                  type="password"
                  required
                  value={newResetPassword}
                  onChange={(e) => setNewResetPassword(e.target.value)}
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-mono text-stone-900 focus:border-amber-600"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-stone-700">Confirm Password</label>
                <input
                  type="password"
                  required
                  value={confirmResetPassword}
                  onChange={(e) => setConfirmResetPassword(e.target.value)}
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-mono text-stone-900 focus:border-amber-600"
                />
              </div>

              <div className="pt-0.5">
                <button
                  type="button"
                  onClick={() => {
                    const generated = generateTemporaryPassword();
                    setNewResetPassword(generated);
                    setConfirmResetPassword(generated);
                    info(`Temporary password: ${generated} — share it securely with the employee.`);
                  }}
                  className="text-[10px] font-bold text-amber-800 hover:underline cursor-pointer"
                >
                  Generate Strong Password
                </button>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setResetPasswordEmployee(null)}
                  className="px-3.5 py-2 rounded-xl border border-stone-200 text-stone-600 text-xs font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingReset}
                  className="px-4 py-2 rounded-xl bg-amber-700 hover:bg-amber-800 text-white text-xs font-bold shadow-xs cursor-pointer flex items-center gap-1.5"
                >
                  {submittingReset ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : null}
                  <span>Confirm Reset</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 4: DELETE EMPLOYEE CONFIRMATION */}
      {/* ========================================================================= */}
      {deletingEmployee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/35 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-rose-200 space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="w-10 h-10 rounded-2xl bg-rose-100 flex items-center justify-center shrink-0">
                <AlertCircle className="w-5 h-5 text-rose-700" />
              </div>
              <div>
                <h3 className="font-serif font-bold text-lg text-stone-900">
                  Remove Employee?
                </h3>
                <p className="text-xs text-stone-500">
                  This action removes employee access immediately.
                </p>
              </div>
            </div>

            <p className="text-xs text-stone-600 leading-relaxed">
              Are you sure you want to remove{' '}
              <strong className="text-stone-900">
                {deletingEmployee.firstName} {deletingEmployee.lastName}
              </strong>{' '}
              ({deletingEmployee.role})?
            </p>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-stone-100">
              <button
                type="button"
                onClick={() => setDeletingEmployee(null)}
                className="px-3.5 py-2 rounded-xl border border-stone-200 text-stone-600 text-xs font-bold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteEmployee}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-xs cursor-pointer"
              >
                Yes, Remove
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
