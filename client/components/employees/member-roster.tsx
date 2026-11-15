"use client";

import { MemberPickerToolbar, type MemberRoleFilter } from "@/components/shared/member-picker-toolbar";
import { UserAvatar } from "@/components/shared/user-avatar";
import type { CRMUser, Department, UserRole } from "@/types/crm";

const FIELD_STYLE = { borderColor: "var(--border)", background: "var(--surface-soft)", color: "var(--text-main)" } as const;

type Props = {
  users: CRMUser[]; filteredUsers: CRMUser[]; departments: Department[]; managers: CRMUser[];
  dataLoading: boolean; hasMore: boolean; loadingMore: boolean;
  directoryRoleOptions: UserRole[]; emailDrafts: Record<string, string>;
  updatingId: string; emailUpdatingId: string; deletingId: string;
  searchQuery: string; onSearchChange: (q: string) => void;
  roleFilter: MemberRoleFilter; onRoleFilterChange: (r: MemberRoleFilter) => void;
  roleFilterOptions: UserRole[];
  canManageRow: (m: CRMUser) => boolean; canEditEmail: (m: CRMUser) => boolean; canDelete: (m: CRMUser) => boolean;
  hasLeadershipLinks: (m: CRMUser) => boolean;
  onEmailDraftChange: (id: string, email: string) => void;
  onAssign: (m: CRMUser, field: "role" | "departmentId" | "managerId", value: string) => void;
  onEmailUpdate: (m: CRMUser) => void; onDelete: (m: CRMUser) => void;
  onLoadMore: () => void;
  currentUserId: string; currentUserRole: UserRole;
};

export function MemberRoster({ users, filteredUsers, departments, managers, dataLoading, hasMore, loadingMore, directoryRoleOptions, emailDrafts, updatingId, emailUpdatingId, deletingId, searchQuery, onSearchChange, roleFilter, onRoleFilterChange, roleFilterOptions, canManageRow, canEditEmail, canDelete, hasLeadershipLinks, onEmailDraftChange, onAssign, onEmailUpdate, onDelete, onLoadMore, currentUserId, currentUserRole }: Props) {
  return (
    <section className="min-w-0 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5 shadow-xs">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <span className="rounded-md bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-[var(--accent)] border border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800">
            Directory
          </span>
          <h2 className="mt-1 text-lg font-bold text-[var(--text-main)] sm:text-xl">Team Members</h2>
        </div>
        <span className="text-xs text-[var(--text-soft)]">{filteredUsers.length} of {users.length} members</span>
      </div>
      <div className="mt-4">
        <MemberPickerToolbar searchQuery={searchQuery} onSearchChange={onSearchChange} roleFilter={roleFilter} onRoleFilterChange={onRoleFilterChange} roleOptions={roleFilterOptions} />
      </div>
      {dataLoading ? <p className="mt-6 text-sm text-[var(--text-soft)]">Loading team…</p>
        : users.length === 0 ? <p className="mt-6 rounded-xl border border-dashed border-[var(--border)] p-8 text-center text-sm text-[var(--text-soft)]">No team members yet.</p>
        : filteredUsers.length === 0 ? <p className="mt-6 rounded-xl border border-dashed border-[var(--border)] p-8 text-center text-sm text-[var(--text-soft)]">No matching members. Try a different search or role filter.</p>
        : (
          <>
          <div className="crm-mobile-card-grid mt-6">
            {filteredUsers.map((member) => {
              const locked = !canManageRow(member) || (member.role === "SUPERADMIN" && currentUserRole !== "SUPERADMIN");
              return (
                <article
                  key={member.id}
                  className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3.5 shadow-xs"
                >
                  <div className="flex items-start gap-3">
                    <UserAvatar
                      name={member.name}
                      avatarUrl={member.avatarUrl}
                      authProvider={member.authProvider}
                      className="h-10 w-10 shrink-0 rounded-full text-[10px]"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-[var(--text-main)]">{member.name}</p>
                      <p className="mt-0.5 text-xs text-[var(--text-soft)]">{member.designation?.trim() || "No designation"}</p>
                      <p className="mt-1 text-xs text-[var(--text-faint)]">{member.email}</p>
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-md border border-[var(--border)] bg-[var(--surface-soft)] px-2 py-1.5">
                      <p className="text-[10px] text-[var(--text-faint)]">Role</p>
                      <p className="mt-0.5 font-medium text-[var(--text-main)]">{member.role}</p>
                    </div>
                    <div className="rounded-md border border-[var(--border)] bg-[var(--surface-soft)] px-2 py-1.5">
                      <p className="text-[10px] text-[var(--text-faint)]">Department</p>
                      <p className="mt-0.5 truncate font-medium text-[var(--text-main)]">{member.department?.name || "—"}</p>
                    </div>
                  </div>
                  {!locked && canEditEmail(member) ? (
                    <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                      <input
                        className="h-9 min-w-0 flex-1 rounded-md border border-[var(--border)] bg-[var(--surface)] px-2.5 text-xs outline-none focus:border-[var(--accent)]"
                        value={emailDrafts[member.id] ?? member.email}
                        disabled={emailUpdatingId === member.id}
                        onChange={(e) => onEmailDraftChange(member.id, e.target.value)}
                      />
                      <button
                        type="button"
                        className="h-9 rounded-md bg-[var(--accent)] hover:bg-[var(--accent-strong)] px-3 text-xs font-semibold text-white disabled:opacity-50 transition-colors"
                        disabled={emailUpdatingId === member.id || (emailDrafts[member.id] ?? member.email).trim() === member.email}
                        onClick={() => onEmailUpdate(member)}
                      >
                        {emailUpdatingId === member.id ? "…" : "Update"}
                      </button>
                    </div>
                  ) : null}
                  {canDelete(member) ? (
                    <button
                      type="button"
                      className="mt-3 w-full rounded-md border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50 dark:border-rose-800 dark:text-rose-300 dark:hover:bg-rose-950/40 disabled:opacity-50 transition-colors"
                      disabled={deletingId === member.id}
                      onClick={() => onDelete(member)}
                    >
                      {deletingId === member.id ? "Removing…" : "Remove member"}
                    </button>
                  ) : null}
                </article>
              );
            })}
          </div>
          <div className="crm-desktop-table mt-4 w-full min-w-0 overflow-x-auto rounded-lg border border-[var(--border)] crm-table-scroll">
            <table className="min-w-[920px] w-full text-left text-xs">
              <thead className="bg-[var(--surface-soft)] border-b border-[var(--border)]">
                <tr className="font-semibold text-[var(--text-soft)]">
                  <th className="whitespace-nowrap px-4 py-2.5">Name</th>
                  <th className="min-w-[220px] whitespace-nowrap px-4 py-2.5">Email</th>
                  <th className="whitespace-nowrap px-4 py-2.5">Role</th>
                  <th className="whitespace-nowrap px-4 py-2.5">Department</th>
                  <th className="whitespace-nowrap px-4 py-2.5">Manager</th>
                  <th className="whitespace-nowrap px-4 py-2.5">Meet</th>
                  <th className="whitespace-nowrap px-4 py-2.5">Drive</th>
                  <th className="whitespace-nowrap px-4 py-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-[var(--surface)] divide-y divide-[var(--border)] text-[var(--text-main)]">
                {filteredUsers.map((member) => {
                  const locked = !canManageRow(member) || (member.role === "SUPERADMIN" && currentUserRole !== "SUPERADMIN");
                  return (
                    <tr key={member.id} className="hover:bg-[var(--surface-soft)] transition-colors">
                      <td className="px-4 py-2.5 align-middle">
                        <div className="flex items-center gap-2.5">
                          <UserAvatar
                            name={member.name}
                            avatarUrl={member.avatarUrl}
                            authProvider={member.authProvider}
                            className="h-8 w-8 shrink-0 rounded-full text-[10px]"
                          />
                          <div>
                            <div className="font-semibold text-[var(--text-main)]">{member.name}</div>
                            <div className="text-[11px] text-[var(--text-soft)]">{member.designation?.trim() || "No designation"}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 align-middle">
                        {canEditEmail(member) ? (
                          <div className="flex min-w-[200px] max-w-[min(100%,320px)] items-center gap-1.5">
                            <input className="h-7.5 min-w-0 flex-1 rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 text-xs outline-none focus:border-[var(--accent)]"
                              value={emailDrafts[member.id] ?? member.email}
                              disabled={emailUpdatingId === member.id || (member.role === "SUPERADMIN" && currentUserRole !== "SUPERADMIN")}
                              onChange={(e) => onEmailDraftChange(member.id, e.target.value)} />
                            <button type="button" className="h-7.5 shrink-0 rounded-md bg-[var(--accent)] hover:bg-[var(--accent-strong)] px-2.5 text-xs font-semibold text-white disabled:opacity-50 transition-colors"
                              disabled={emailUpdatingId === member.id || (member.role === "SUPERADMIN" && currentUserRole !== "SUPERADMIN") || (emailDrafts[member.id] ?? member.email).trim() === member.email}
                              onClick={() => onEmailUpdate(member)}>
                              {emailUpdatingId === member.id ? "…" : "Update"}
                            </button>
                          </div>
                        ) : <span className="text-xs">{member.email}</span>}
                      </td>
                      <td className="px-4 py-2.5 align-middle">
                        {locked ? <span className="inline-block rounded-md bg-[var(--surface-soft)] border border-[var(--border)] px-2 py-0.5 text-xs font-medium">{member.role}</span>
                          : <select className="w-full min-w-[7.5rem] rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-xs font-medium outline-none focus:border-[var(--accent)]" value={member.role} disabled={updatingId === member.id} onChange={(e) => onAssign(member, "role", e.target.value)}>
                              {directoryRoleOptions.map((r) => <option key={r} value={r}>{r}</option>)}
                            </select>}
                      </td>
                      <td className="px-4 py-2.5 align-middle">
                        {locked ? <span className="text-xs">{member.department?.name || "—"}</span>
                          : <select className="w-full min-w-[8rem] rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-xs outline-none focus:border-[var(--accent)]" value={member.department?.id ?? ""} disabled={updatingId === member.id} onChange={(e) => onAssign(member, "departmentId", e.target.value)}>
                              <option value="">Unassigned</option>
                              {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                            </select>}
                      </td>
                      <td className="px-4 py-2.5 align-middle">
                        {locked ? <span className="text-xs">{member.manager?.name || "—"}</span>
                          : <select className="w-full min-w-[8rem] rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-xs outline-none focus:border-[var(--accent)]" value={member.manager?.id ?? ""} disabled={updatingId === member.id} onChange={(e) => onAssign(member, "managerId", e.target.value)}>
                              <option value="">Unassigned</option>
                              {managers.filter((m) => m.id !== member.id).map((m) => <option key={m.id} value={m.id}>{m.name} — {m.role}</option>)}
                            </select>}
                      </td>
                      <td className="px-4 py-2.5 align-middle">
                        {hasLeadershipLinks(member) ? <a href="https://meet.google.com/" target="_blank" rel="noreferrer" className="text-xs font-medium text-[var(--accent)] hover:underline">Meet</a> : "—"}
                      </td>
                      <td className="px-4 py-2.5 align-middle">
                        {hasLeadershipLinks(member) ? <a href="https://drive.google.com/" target="_blank" rel="noreferrer" className="text-xs font-medium text-[var(--accent)] hover:underline">Drive</a> : "—"}
                      </td>
                      <td className="px-4 py-2.5 text-right align-middle">
                        {canDelete(member) ? (
                          <button type="button" className="rounded-md border border-rose-200 px-2 py-1 text-xs font-medium text-rose-700 transition hover:bg-rose-50 dark:border-rose-800 dark:text-rose-300 dark:hover:bg-rose-950/40 disabled:opacity-50" disabled={deletingId === member.id} onClick={() => onDelete(member)}>
                            {deletingId === member.id ? "…" : "Delete"}
                          </button>
                        ) : <span className="text-[var(--text-faint)]">—</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          </>
        )}
      {hasMore ? (
        <div className="mt-4 flex justify-center">
          <button type="button" disabled={loadingMore} onClick={onLoadMore} className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-1.5 text-xs font-semibold text-[var(--text-main)] hover:bg-[var(--surface-hover)] disabled:opacity-60 transition-colors">
            {loadingMore ? "Loading…" : "Load more"}
          </button>
        </div>
      ) : null}
    </section>
  );
}
