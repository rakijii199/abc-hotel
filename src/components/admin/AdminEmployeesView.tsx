/**
 * Employee & Staff Management View
 * Clean Light UI: Header -> Filters -> Staff Table
 * Roles: Manager, Staff, Kitchen, Delivery
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
  Mail,
  UserX,
  Lock,
  Eye,
  EyeOff
} from 'lucide-react';
import { SafeUser, UserRole, UserStatus } from '../../types/index.ts';
import { ManagerApi } from '../../api/index.ts';
import { useAuth } from '../../context/AuthContext.tsx';
import { useToast } from '../../context/ToastContext.tsx';

interface AdminEmployeesViewProps {
  onRefreshStats?: () => void;
}

export const AdminEmployeesView: React.FC<AdminEmployeesViewProps> = ({ onRefreshStats }) => {
  const { user: currentUser } = useAuth();
  const { error, success, info } = useToast();

  const [employees, setEmployees] = useState<SafeUser[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
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
  const [newPassword, setNewPassword] = useState('Password@123');
  const [newConfirmPassword, setNewConfirmPassword] = useState('Password@123');
  const [showPassword, setShowPassword] = useState(false);
  const [submittingAdd, setSubmittingAdd] = useState(false);

  // Edit Employee Form State
  const [editFirstName, setEditFirstName] = useState('');
  const [editLastName, setEditLastName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editRole, setEditRole] = useState<UserRole>('STAFF');
  const [editStatus, setEditStatus] = useState<UserStatus>('ACTIVE');
  const [submittingEdit, setSubmittingEdit] = useState(false);

  // Reset Password State
  const [newResetPassword, setNewResetPassword] = useState('Password@123');
  const [confirmResetPassword, setConfirmResetPassword] = useState('Password@123');
  const [submittingReset, setSubmittingReset] = useState(false);

  const fetchEmployeesData = async (isBackground = false) => {
    if (!isBackground) setRefreshing(true);
    try {
      const list = await ManagerApi.getEmployees({
        role: roleFilter !== 'ALL' ? roleFilter : undefined,
        status: statusFilter !== 'ALL' ? statusFilter : undefined,
        search: searchQuery.trim() || undefined
      });

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
  }, [roleFilter, statusFilter]);

  // Handle live search with debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchEmployeesData(true);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

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
        status: 'ACTIVE'
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
      setNewPassword('Password@123');
      setNewConfirmPassword('Password@123');
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
    setEditRole(emp.role === 'ADMIN' ? 'STAFF' : emp.role);
    setEditStatus(emp.status);
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
        status: editStatus
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
      setNewResetPassword('Password@123');
      setConfirmResetPassword('Password@123');
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

  // Role Badges
  const getRoleBadge = (role: UserRole) => {
    switch (role) {
      case 'MANAGER':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-800 border border-purple-200">
            <Shield className="w-3 h-3 text-purple-700" />
            Manager
          </span>
        );
      case 'STAFF':
      case 'ADMIN':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-200">
            <Briefcase className="w-3 h-3 text-blue-700" />
            Staff
          </span>
        );
      case 'KITCHEN':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
            <ChefHat className="w-3 h-3 text-amber-700" />
            Kitchen
          </span>
        );
      case 'DELIVERY':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
            <Truck className="w-3 h-3 text-emerald-700" />
            Delivery
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-stone-100 text-stone-700 border border-stone-200">
            {role}
          </span>
        );
    }
  };

  return (
    <div className="space-y-4">
      {/* Light Clean Header */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-stone-200 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-amber-700" />
            <h1 className="font-serif font-bold text-xl text-stone-900 tracking-tight">
              Employee Management
            </h1>
          </div>
          <p className="text-xs text-stone-500 mt-0.5">
            Manage hotel staff accounts, department roles, and access credentials.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => fetchEmployeesData()}
            disabled={refreshing}
            className="p-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 border border-stone-200 transition-all cursor-pointer"
            title="Refresh List"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-amber-700' : ''}`} />
          </button>

          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 rounded-xl bg-amber-700 hover:bg-amber-800 text-white text-xs font-bold shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>Add Employee</span>
          </button>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-white p-3 rounded-2xl border border-stone-200 shadow-2xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, username (@), email, or mobile..."
            className="w-full pl-10 pr-4 py-1.5 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-900 placeholder:text-stone-400 focus:outline-hidden focus:border-amber-600 focus:bg-white transition-all"
          />
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-stone-500 shrink-0">Role:</span>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="px-2.5 py-1.5 bg-stone-50 border border-stone-200 rounded-xl text-xs font-medium text-stone-700 focus:outline-hidden focus:border-amber-600 cursor-pointer"
            >
              <option value="ALL">All Roles</option>
              <option value="MANAGER">Manager</option>
              <option value="STAFF">Staff</option>
              <option value="KITCHEN">Kitchen</option>
              <option value="DELIVERY">Delivery</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5 ml-1">
            <span className="text-xs font-semibold text-stone-500 shrink-0">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-2.5 py-1.5 bg-stone-50 border border-stone-200 rounded-xl text-xs font-medium text-stone-700 focus:outline-hidden focus:border-amber-600 cursor-pointer"
            >
              <option value="ALL">All Statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>
          </div>
        </div>
      </div>

      {/* Staff Directory Table */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-2xs overflow-hidden">
        <div className="p-3.5 sm:p-4 border-b border-stone-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="font-serif font-bold text-base text-stone-900">
              Staff Directory ({employees.length})
            </h3>
            {searchQuery && (
              <span className="text-[11px] bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.2 rounded-full font-mono">
                "{searchQuery}"
              </span>
            )}
          </div>
        </div>

        {loading ? (
          <div className="p-10 text-center text-stone-400 space-y-2">
            <RefreshCw className="w-5 h-5 animate-spin mx-auto text-amber-700" />
            <p className="text-xs">Loading employees...</p>
          </div>
        ) : employees.length === 0 ? (
          <div className="p-10 text-center text-stone-400 space-y-2">
            <UserX className="w-8 h-8 mx-auto text-stone-300" />
            <p className="text-sm font-semibold text-stone-700">No employees found</p>
            <p className="text-xs text-stone-400 max-w-sm mx-auto">
              No staff members matched your filter criteria.
            </p>
            <button
              onClick={() => {
                setSearchQuery('');
                setRoleFilter('ALL');
                setStatusFilter('ALL');
              }}
              className="text-xs font-bold text-amber-800 hover:underline cursor-pointer"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-stone-50 border-b border-stone-200 text-[10px] uppercase font-bold text-stone-500 tracking-wider">
                <tr>
                  <th className="py-3 px-4">Employee</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4">Username & Email</th>
                  <th className="py-3 px-4">Phone</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {employees.map((emp) => {
                  const isCurrent = emp.id === currentUser?.id;
                  const isActive = emp.status === 'ACTIVE';

                  return (
                    <tr
                      key={emp.id}
                      className={`hover:bg-amber-50/20 transition-colors ${
                        !isActive ? 'bg-stone-50/60 opacity-75' : ''
                      }`}
                    >
                      {/* Name Only */}
                      <td className="py-3 px-4">
                        <span className="font-semibold text-stone-900 text-xs">
                          {emp.firstName} {emp.lastName}
                        </span>
                      </td>

                      {/* Role */}
                      <td className="py-3 px-4">{getRoleBadge(emp.role)}</td>

                      {/* Username & Email */}
                      <td className="py-3 px-4">
                        <div className="space-y-0.5">
                          <div className="font-mono text-[11px] font-semibold text-stone-900">
                            <span className="text-amber-700">@</span>
                            <span>{emp.username || emp.email.split('@')[0]}</span>
                          </div>
                          <div className="flex items-center gap-1 text-[11px] text-stone-500 font-mono">
                            <Mail className="w-3 h-3 text-stone-400 shrink-0" />
                            <span>{emp.email}</span>
                          </div>
                        </div>
                      </td>

                      {/* Phone */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1 text-[11px] text-stone-700 font-mono">
                          <Phone className="w-3 h-3 text-stone-400 shrink-0" />
                          <span>{emp.phone || '—'}</span>
                        </div>
                      </td>

                      {/* Status Toggle Badge */}
                      <td className="py-3 px-4">
                        <button
                          type="button"
                          disabled={isCurrent}
                          onClick={() => handleToggleStatus(emp)}
                          className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-bold border transition-all cursor-pointer ${
                            isActive
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                              : 'bg-rose-50 text-rose-800 border-rose-200 hover:bg-rose-100'
                          } ${isCurrent ? 'opacity-60 cursor-not-allowed' : ''}`}
                          title={isCurrent ? 'Cannot change your own account' : 'Click to toggle status'}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              isActive ? 'bg-emerald-600' : 'bg-rose-600'
                            }`}
                          />
                          {isActive ? 'Active' : 'Inactive'}
                        </button>
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {/* Edit Details */}
                          <button
                            onClick={() => openEditModal(emp)}
                            className="p-1.5 rounded-lg text-stone-500 hover:text-stone-900 hover:bg-stone-100 transition-colors cursor-pointer"
                            title="Edit Employee"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          {/* Reset Password */}
                          <button
                            onClick={() => {
                              setResetPasswordEmployee(emp);
                              setNewResetPassword('Password@123');
                              setConfirmResetPassword('Password@123');
                            }}
                            className="p-1.5 rounded-lg text-amber-700 hover:text-amber-900 hover:bg-amber-50 transition-colors cursor-pointer"
                            title="Reset Password"
                          >
                            <Key className="w-3.5 h-3.5" />
                          </button>

                          {/* Delete / Remove */}
                          {!isCurrent && (
                            <button
                              onClick={() => setDeletingEmployee(emp)}
                              className="p-1.5 rounded-lg text-rose-600 hover:text-rose-800 hover:bg-rose-50 transition-colors cursor-pointer"
                              title="Remove Employee"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* MODAL 1: ADD NEW EMPLOYEE */}
      {/* ========================================================================= */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-stone-200 space-y-4 max-h-[90vh] overflow-y-auto">
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
                  <label
                    onClick={() => setNewRole('MANAGER')}
                    className={`p-2.5 rounded-xl border flex items-center gap-2 cursor-pointer transition-all ${
                      newRole === 'MANAGER'
                        ? 'border-purple-600 bg-purple-50/70 ring-1 ring-purple-500'
                        : 'border-stone-200 hover:bg-stone-50'
                    }`}
                  >
                    <Shield className="w-4 h-4 text-purple-700 shrink-0" />
                    <span className="text-xs font-bold text-stone-900">Manager</span>
                  </label>

                  <label
                    onClick={() => setNewRole('STAFF')}
                    className={`p-2.5 rounded-xl border flex items-center gap-2 cursor-pointer transition-all ${
                      newRole === 'STAFF'
                        ? 'border-blue-600 bg-blue-50/70 ring-1 ring-blue-500'
                        : 'border-stone-200 hover:bg-stone-50'
                    }`}
                  >
                    <Briefcase className="w-4 h-4 text-blue-700 shrink-0" />
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
                    <span className="text-xs font-bold text-stone-900">Kitchen</span>
                  </label>

                  <label
                    onClick={() => setNewRole('DELIVERY')}
                    className={`p-2.5 rounded-xl border flex items-center gap-2 cursor-pointer transition-all ${
                      newRole === 'DELIVERY'
                        ? 'border-emerald-600 bg-emerald-50/70 ring-1 ring-emerald-500'
                        : 'border-stone-200 hover:bg-stone-50'
                    }`}
                  >
                    <Truck className="w-4 h-4 text-emerald-700 shrink-0" />
                    <span className="text-xs font-bold text-stone-900">Delivery</span>
                  </label>
                </div>
              </div>

              {/* Password */}
              <div className="p-3 bg-stone-50 rounded-xl border border-stone-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-stone-800 flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-stone-500" /> Password
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setNewPassword('Password@123');
                      setNewConfirmPassword('Password@123');
                      info('Password set to Password@123');
                    }}
                    className="text-[10px] font-bold text-amber-800 hover:underline cursor-pointer"
                  >
                    Use Default (Password@123)
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-stone-200 space-y-4">
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
                  onChange={(e) => setEditRole(e.target.value as UserRole)}
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-medium text-stone-900 focus:border-amber-600"
                >
                  <option value="MANAGER">Manager</option>
                  <option value="STAFF">Staff</option>
                  <option value="KITCHEN">Kitchen</option>
                  <option value="DELIVERY">Delivery</option>
                </select>
              </div>

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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in">
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
                    setNewResetPassword('Password@123');
                    setConfirmResetPassword('Password@123');
                  }}
                  className="text-[10px] font-bold text-amber-800 hover:underline cursor-pointer"
                >
                  Use Default (Password@123)
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in">
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
