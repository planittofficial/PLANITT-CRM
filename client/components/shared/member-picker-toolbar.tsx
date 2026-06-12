"use client";

import type { CRMUser, UserRole } from "@/types/crm";
import { ResponsiveSelect } from "./responsive-select";

export type MemberRoleFilter = UserRole | "ALL";

function formatRoleLabel(role: UserRole) {
  return role.charAt(0) + role.slice(1).toLowerCase();
}

type Props = {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  roleFilter: MemberRoleFilter;
  onRoleFilterChange: (value: MemberRoleFilter) => void;
  roleOptions: UserRole[];
  className?: string;
};

export function MemberPickerToolbar({
  searchQuery,
  onSearchChange,
  roleFilter,
  onRoleFilterChange,
  roleOptions,
  className = "",
}: Props) {
  return (
    <div className={`flex min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center ${className}`}>
      <label className="relative min-w-0 flex-1 sm:min-w-[200px]">
        <span className="sr-only">Search people</span>
        <input
          type="search"
          value={searchQuery}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Search name, email, role, department…"
          className="crm-input h-10 w-full rounded-md px-3 text-sm"
        />
      </label>
      <label className="flex min-w-0 flex-col gap-1 text-sm text-[var(--text-soft)] sm:min-w-[170px] sm:flex-row sm:items-center sm:gap-2">
        <span className="whitespace-nowrap">Filter by role</span>
        <ResponsiveSelect
  value={roleFilter}
  onChange={(value) =>
    onRoleFilterChange(
      value as MemberRoleFilter
    )
  }
  options={[
    {
      value: "ALL",
      label: "All roles",
    },
    ...roleOptions.map((role) => ({
      value: role,
      label: formatRoleLabel(role),
    })),
  ]}
  ariaLabel="Filter by role"
/>
      </label>
    </div>
  );
}

export function filterMembersForPicker(
  members: CRMUser[],
  opts: {
    searchQuery: string;
    roleFilter: MemberRoleFilter;
    restrictToRoles?: UserRole[] | null;
  }
): CRMUser[] {
  let list = opts.restrictToRoles?.length
    ? members.filter((m) => opts.restrictToRoles!.includes(m.role))
    : members;

  if (opts.roleFilter !== "ALL") {
    list = list.filter((m) => m.role === opts.roleFilter);
  }

  const q = opts.searchQuery.trim().toLowerCase();
  if (!q) {
    return list;
  }

  return list.filter(
    (m) =>
      m.name.toLowerCase().includes(q) ||
      (m.email?.toLowerCase().includes(q) ?? false) ||
      m.role.toLowerCase().includes(q) ||
      (m.department?.name?.toLowerCase().includes(q) ?? false) ||
      (m.designation?.toLowerCase().includes(q) ?? false)
  );
}

export function sortedUniqueRoles(members: CRMUser[]): UserRole[] {
  const set = new Set<UserRole>();
  for (const m of members) {
    set.add(m.role);
  }
  return [...set].sort((a, b) => a.localeCompare(b));
}
