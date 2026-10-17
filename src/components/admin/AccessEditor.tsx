/**
 * Privilege + section-access editor used in the Add / Edit user forms.
 * The role supplies the default template; anything chosen here is stored as a
 * per-user override, shown as "Custom", and can be reset to the role defaults.
 */
import React, { useMemo } from 'react';
import { RotateCcw, ShieldCheck, UserRound } from 'lucide-react';
import {
  ACCESS_LABELS,
  AccessLevel,
  PrivilegeType,
  ROLE_DEFINITIONS,
  SECTIONS,
  SectionId,
  StaffRoleCode
} from '../../../shared/accessControl.ts';

export type RoleTemplates = Partial<Record<StaffRoleCode, Partial<Record<SectionId, AccessLevel>>>>;

const LEVEL_STYLES: Record<AccessLevel, string> = {
  FULL: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  VIEW: 'bg-sky-50 text-sky-800 border-sky-200',
  NONE: 'bg-stone-100 text-stone-500 border-stone-200'
};

export const AccessLevelChip: React.FC<{ level: AccessLevel; className?: string }> = ({ level, className = '' }) => (
  <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[10.5px] font-semibold whitespace-nowrap ${LEVEL_STYLES[level]} ${className}`}>
    {ACCESS_LABELS[level]}
  </span>
);

export const PrivilegeChip: React.FC<{ privilege: PrivilegeType | null | undefined }> = ({ privilege }) =>
  privilege === 'SUPER_ADMIN' ? (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10.5px] font-semibold bg-[var(--brand-soft-hover)] text-[var(--brand-text)] border-[var(--brand-border)] whitespace-nowrap">
      <ShieldCheck className="w-3 h-3" /> Super Admin
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10.5px] font-semibold bg-white text-stone-600 border-stone-200 whitespace-nowrap">
      <UserRound className="w-3 h-3" /> User
    </span>
  );

export function roleTemplate(role: StaffRoleCode, templates?: RoleTemplates): Partial<Record<SectionId, AccessLevel>> {
  return templates?.[role] || ROLE_DEFINITIONS.find((r) => r.code === role)?.defaultAccess || {};
}

interface AccessEditorProps {
  role: StaffRoleCode;
  privilege: PrivilegeType;
  onPrivilegeChange: (p: PrivilegeType) => void;
  overrides: Partial<Record<SectionId, AccessLevel>>;
  onOverridesChange: (next: Partial<Record<SectionId, AccessLevel>>) => void;
  templates?: RoleTemplates;
  /** Only Super Admins can grant/revoke Super Admin or change access. */
  editable: boolean;
}

export const AccessEditor: React.FC<AccessEditorProps> = ({
  role,
  privilege,
  onPrivilegeChange,
  overrides,
  onOverridesChange,
  templates,
  editable
}) => {
  const roleDef = ROLE_DEFINITIONS.find((r) => r.code === role)!;
  const template = roleTemplate(role, templates);
  const effective = useMemo(
    () =>
      SECTIONS.map((s) => ({
        section: s,
        level: (privilege === 'SUPER_ADMIN' ? 'FULL' : overrides[s.id] || template[s.id] || 'NONE') as AccessLevel,
        custom: privilege !== 'SUPER_ADMIN' && !!overrides[s.id]
      })),
    [privilege, overrides, template]
  );
  const counts = effective.reduce((acc, e) => ({ ...acc, [e.level]: (acc[e.level] || 0) + 1 }), {} as Record<AccessLevel, number>);
  const customCount = Object.keys(overrides).length;

  const setLevel = (section: SectionId, value: string) => {
    const next = { ...overrides };
    if (value === 'INHERIT') delete next[section];
    else next[section] = value as AccessLevel;
    onOverridesChange(next);
  };

  return (
    <div className="space-y-3 p-3 rounded-xl border border-[var(--border-subtle)] bg-stone-50/60">
      {/* Privilege type */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-bold text-stone-700">Privilege type</span>
          <span className="text-[10.5px] text-stone-500">Role default: {roleDef.defaultPrivilege === 'SUPER_ADMIN' ? 'Super Admin' : 'User'}</span>
        </div>
        <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Privilege type">
          {(['SUPER_ADMIN', 'USER'] as PrivilegeType[]).map((p) => (
            <button
              key={p}
              type="button"
              role="radio"
              aria-checked={privilege === p}
              disabled={!editable}
              onClick={() => onPrivilegeChange(p)}
              className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer disabled:cursor-not-allowed disabled:opacity-60 ${
                privilege === p ? 'border-amber-600 bg-amber-50/80 ring-1 ring-amber-500' : 'border-stone-200 bg-white hover:bg-[var(--brand-soft)]'
              }`}
            >
              <span className="block text-xs font-bold text-stone-900">{p === 'SUPER_ADMIN' ? 'Super Admin' : 'User'}</span>
              <span className="block text-[10.5px] text-stone-500 leading-snug mt-0.5">
                {p === 'SUPER_ADMIN' ? 'Manages users, roles, access and settings; full access to all sections.' : 'Only the sections and actions granted below.'}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Section access */}
      {privilege === 'SUPER_ADMIN' ? (
        <p className="text-[11px] text-stone-600 bg-white border border-stone-200 rounded-lg px-3 py-2">
          Super Admins have Full Access to every section. Choose <strong>User</strong> to limit access by section.
        </p>
      ) : (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold text-stone-700">Section access</span>
            {customCount > 0 && editable && (
              <button type="button" onClick={() => onOverridesChange({})} className="btn btn-ghost !min-h-8 !px-2 !text-[11px]">
                <RotateCcw className="w-3.5 h-3.5" /> Reset to {roleDef.name} defaults ({customCount} custom)
              </button>
            )}
          </div>
          <div className="max-h-64 overflow-y-auto rounded-lg border border-stone-200 bg-white divide-y divide-stone-100">
            {effective.map(({ section, level, custom }) => (
              <div key={section.id} className="flex items-center justify-between gap-3 px-3 py-1.5">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-stone-800 truncate">
                    {section.label}
                    {custom && <span className="ml-1.5 text-[9.5px] font-bold uppercase tracking-wide text-[var(--brand-text)]">Custom</span>}
                  </p>
                  <p className="text-[10.5px] text-stone-400 truncate">{section.description}</p>
                </div>
                <select
                  aria-label={`${section.label} access`}
                  value={overrides[section.id] || 'INHERIT'}
                  disabled={!editable}
                  onChange={(e) => setLevel(section.id, e.target.value)}
                  className="shrink-0 w-40 px-2 py-1.5 bg-white border border-stone-200 rounded-lg text-[11px] text-stone-800 focus:outline-hidden focus:border-amber-600 disabled:opacity-60"
                >
                  <option value="INHERIT">Role default ({ACCESS_LABELS[(template[section.id] || 'NONE') as AccessLevel]})</option>
                  <option value="FULL">Full Access</option>
                  <option value="VIEW">View Access</option>
                  <option value="NONE">No Access</option>
                </select>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Summary */}
      <div className="rounded-lg bg-white border border-stone-200 px-3 py-2 space-y-1.5" aria-live="polite">
        <p className="text-[11px] font-bold text-stone-700">
          Permission summary: {roleDef.name} · {privilege === 'SUPER_ADMIN' ? 'Super Admin' : 'User'}
        </p>
        <div className="flex flex-wrap gap-1.5">
          <AccessLevelChip level="FULL" className="!text-[10px]" />
          <span className="text-[11px] text-stone-600 self-center">{counts.FULL || 0}</span>
          <AccessLevelChip level="VIEW" className="!text-[10px]" />
          <span className="text-[11px] text-stone-600 self-center">{counts.VIEW || 0}</span>
          <AccessLevelChip level="NONE" className="!text-[10px]" />
          <span className="text-[11px] text-stone-600 self-center">{counts.NONE || 0}</span>
        </div>
        {privilege !== 'SUPER_ADMIN' && (
          <p className="text-[10.5px] text-stone-500 leading-relaxed">
            Can use: {effective.filter((e) => e.level !== 'NONE').map((e) => `${e.section.label}${e.level === 'VIEW' ? ' (view)' : ''}`).join(', ') || 'nothing yet'}
          </p>
        )}
      </div>
    </div>
  );
};
