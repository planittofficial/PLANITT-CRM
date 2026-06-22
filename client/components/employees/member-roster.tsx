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
    <section className="min-w-0 rounded-2xl border p-5 sm:p-6" style={{ background: "var(--surface)", borderColor: "var(--border)", boxShadow: "var(--shadow-soft)" }}>
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--text-faint)]">Directory</p>
          <h2 className="mt-1 text-lg font-semibold text-[var(--text-main)] sm:text-xl">Current team</h2>
        </div>
        <span className="text-sm text-[var(--text-soft)]">{filteredUsers.length}/{users.length} members</span>
      </div>
      <div className="mt-4">
        <MemberPickerToolbar searchQuery={searchQuery} onSearchChange={onSearchChange} roleFilter={roleFilter} onRoleFilterChange={onRoleFilterChange} roleOptions={roleFilterOptions} />
      </div>
      {dataLoading ? <p className="mt-6 text-sm text-[var(--text-soft)]">Loading team…</p>
        : users.length === 0 ? <p className="mt-6 rounded-xl border border-dashed p-8 text-center text-sm text-[var(--text-soft)]">No team members yet.</p>
        : filteredUsers.length === 0 ? <p className="mt-6 rounded-xl border border-dashed p-8 text-center text-sm text-[var(--text-soft)]">No matching members. Try a different search or role filter.</p>
        : (
          <>
          <div className="crm-mobile-card-grid mt-6">
            {filteredUsers.map((member) => {
              const locked = !canManageRow(member) || (member.role === "SUPERADMIN" && currentUserRole !== "SUPERADMIN");
              return (
                <article
                  key={member.id}
                  className="rounded-xl border p-4"
                  style={{ borderColor: "var(--border)", background: "var(--surface-strong)" }}
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
                    <div className="rounded-lg border px-2 py-1.5" style={{ borderColor: "var(--border)", background: "var(--surface-soft)" }}>
                      <p className="text-[10px] uppercase tracking-wide text-[var(--text-faint)]">Role</p>
                      <p className="mt-0.5 font-medium text-[var(--text-main)]">{member.role}</p>
                    </div>
                    <div className="rounded-lg border px-2 py-1.5" style={{ borderColor: "var(--border)", background: "var(--surface-soft)" }}>
                      <p className="text-[10px] uppercase tracking-wide text-[var(--text-faint)]">Department</p>
                      <p className="mt-0.5 truncate font-medium text-[var(--text-main)]">{member.department?.name || "—"}</p>
                    </div>
                  </div>
                  {!locked && canEditEmail(member) ? (
                    <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                      <input
                        className="h-10 min-w-0 flex-1 rounded-lg border px-3 text-xs outline-none"
                        style={FIELD_STYLE}
                        value={emailDrafts[member.id] ?? member.email}
                        disabled={emailUpdatingId === member.id}
                        onChange={(e) => onEmailDraftChange(member.id, e.target.value)}
                      />
                      <button
                        type="button"
                        className="crm-touch-target h-10 rounded-lg px-3 text-xs font-semibold text-white disabled:opacity-50"
                        style={{ background: "var(--accent-strong)" }}
                        disabled={emailUpdatingId === member.id || (emailDrafts[member.id] ?? member.email).trim() === member.email}
                        onClick={() => onEmailUpdate(member)}
                      >
                        {emailUpdatingId === member.id ? "…" : "Update email"}
                      </button>
                    </div>
                  ) : null}
                  {canDelete(member) ? (
                    <button
                      type="button"
                      className="crm-touch-target mt-3 w-full rounded-lg border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-700 disabled:opacity-50"
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
          <div className="crm-desktop-table mt-6 w-full min-w-0 overflow-x-auto rounded-[20px] border crm-table-scroll" style={{ borderColor: "var(--border)" }}>
            <table className="min-w-[920px] w-full text-left text-sm">
              <thead style={{ background: "var(--surface-soft)" }}>
                <tr className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-faint)]">
                  <th className="whitespace-nowrap px-4 py-3 sm:px-5">Name</th>
                  <th className="min-w-[220px] whitespace-nowrap px-4 py-3 sm:px-5">Email</th>
                  <th className="whitespace-nowrap px-4 py-3 sm:px-5">Role</th>
                  <th className="whitespace-nowrap px-4 py-3 sm:px-5">Department</th>
                  <th className="whitespace-nowrap px-4 py-3 sm:px-5">Manager</th>
                  <th className="whitespace-nowrap px-4 py-3 sm:px-5">Meet</th>
                  <th className="whitespace-nowrap px-4 py-3 sm:px-5">Drive</th>
                  <th className="whitespace-nowrap px-4 py-3 text-right sm:px-5">Actions</th>
                </tr>
              </thead>
              <tbody style={{ background: "var(--surface-strong)", color: "var(--text-soft)" }}>
                {filteredUsers.map((member) => {
                  const locked = !canManageRow(member) || (member.role === "SUPERADMIN" && currentUserRole !== "SUPERADMIN");
                  return (
                    <tr key={member.id} className="border-t" style={{ borderColor: "var(--border)" }}>
                      <td className="px-4 py-3 align-top sm:px-5 sm:py-4">
                        <div className="flex items-center gap-3">
                          <UserAvatar
                            name={member.name}
                            avatarUrl={member.avatarUrl}
                            authProvider={member.authProvider}
                            className="h-9 w-9 shrink-0 rounded-full text-[10px]"
                          />
                          <div>
                            <div className="font-medium text-[var(--text-main)]">{member.name}</div>
                            <div className="mt-1 text-xs font-medium text-[var(--text-faint)]">{member.designation?.trim() || "No designation"}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 align-top sm:px-5 sm:py-4">
                        {canEditEmail(member) ? (
                          <div className="flex min-w-[200px] max-w-[min(100%,360px)] flex-wrap items-center gap-2">
                            <input className="h-9 min-w-0 flex-1 rounded-lg border px-2 text-xs outline-none sm:rounded-xl sm:px-3" style={FIELD_STYLE}
                              value={emailDrafts[member.id] ?? member.email}
                              disabled={emailUpdatingId === member.id || (member.role === "SUPERADMIN" && currentUserRole !== "SUPERADMIN")}
                              onChange={(e) => onEmailDraftChange(member.id, e.target.value)} />
                            <button type="button" className="h-9 shrink-0 rounded-lg px-3 text-xs font-semibold text-white disabled:opacity-50 sm:rounded-xl" style={{ background: "var(--accent-strong)" }}
                              disabled={emailUpdatingId === member.id || (member.role === "SUPERADMIN" && currentUserRole !== "SUPERADMIN") || (emailDrafts[member.id] ?? member.email).trim() === member.email}
                              onClick={() => onEmailUpdate(member)}>
                              {emailUpdatingId === member.id ? "…" : "Update"}
                            </button>
                          </div>
                        ) : <span className="text-xs sm:text-sm">{member.email}</span>}
                      </td>
                      <td className="px-4 py-3 align-top sm:px-5 sm:py-4">
                        {locked ? <span className="inline-block rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase sm:text-xs" style={{ background: "var(--surface-soft)", color: "var(--text-soft)" }}>{member.role}</span>
                          : <select className="w-full min-w-[8rem] max-w-[9.5rem] rounded-xl border px-2 py-1.5 text-xs font-semibold" style={FIELD_STYLE} value={member.role} disabled={updatingId === member.id} onChange={(e) => onAssign(member, "role", e.target.value)}>
                              {directoryRoleOptions.map((r) => <option key={r} value={r}>{r}</option>)}
                            </select>}
                      </td>
                      <td className="px-4 py-3 align-top sm:px-5 sm:py-4">
                        {locked ? <span className="text-xs">{member.department?.name || "—"}</span>
                          : <select className="w-full min-w-[8.5rem] max-w-[10rem] rounded-xl border px-2 py-1.5 text-xs" style={FIELD_STYLE} value={member.department?.id ?? ""} disabled={updatingId === member.id} onChange={(e) => onAssign(member, "departmentId", e.target.value)}>
                              <option value="">Unassigned</option>
                              {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                            </select>}
                      </td>
                      <td className="px-4 py-3 align-top sm:px-5 sm:py-4">
                        {locked ? <span className="text-xs">{member.manager?.name || "—"}</span>
                          : <select className="w-full min-w-[8.5rem] max-w-[10rem] rounded-xl border px-2 py-1.5 text-xs" style={FIELD_STYLE} value={member.manager?.id ?? ""} disabled={updatingId === member.id} onChange={(e) => onAssign(member, "managerId", e.target.value)}>
                              <option value="">Unassigned</option>
                              {managers.filter((m) => m.id !== member.id).map((m) => <option key={m.id} value={m.id}>{m.name} — {m.role}</option>)}
                            </select>}
                      </td>
                      <td className="px-4 py-3 align-top sm:px-5 sm:py-4">
                        {hasLeadershipLinks(member) ? <a href="https://meet.google.com/" target="_blank" rel="noreferrer" className="text-xs font-semibold underline underline-offset-2" style={{ color: "var(--accent-strong)" }}>Open Meet</a> : "—"}
                      </td>
                      <td className="px-4 py-3 align-top sm:px-5 sm:py-4">
                        {hasLeadershipLinks(member) ? <a href="https://drive.google.com/" target="_blank" rel="noreferrer" className="text-xs font-semibold underline underline-offset-2" style={{ color: "var(--accent-strong)" }}>Open Drive</a> : "—"}
                      </td>
                      <td className="px-4 py-3 text-right align-top sm:px-5 sm:py-4">
                        {canDelete(member) ? (
                          <button type="button" className="rounded-lg border border-rose-200 px-2 py-1.5 text-xs font-semibold text-rose-700 transition hover:bg-rose-50 disabled:opacity-50" disabled={deletingId === member.id} onClick={() => onDelete(member)}>
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
        <div className="mt-5 flex justify-center">
          <button type="button" disabled={loadingMore} onClick={onLoadMore} className="rounded-xl border px-4 py-2 text-sm font-semibold disabled:opacity-60" style={{ borderColor: "var(--border)", color: "var(--text-main)" }}>
            {loadingMore ? "Loading…" : "Load more"}
          </button>
        </div>
      ) : null}
    </section>
  );
}
