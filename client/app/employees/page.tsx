"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CRMShell } from "@/components/layout/crm-shell";
import { sortedUniqueRoles, type MemberRoleFilter } from "@/components/shared/member-picker-toolbar";
import { filterMembersForPicker } from "@/components/shared/member-picker-toolbar";
import { renderSessionGate } from "@/components/shared/session-gate";
import { useRealtimeRefresh } from "@/hooks/use-realtime-refresh";
import { useSession } from "@/hooks/use-session";
import { apiDelete, apiGet, apiPost, apiPostForm, apiPut } from "@/lib/api";
import { EmployeesSkeleton } from "@/components/shared/skeleton";
import { CreateMemberPanel, type CreateMemberForm } from "@/components/employees/create-member-panel";
import { MemberRoster } from "@/components/employees/member-roster";
import { useCrmSearch } from "@/components/providers/crm-search-provider";
import type { BulkUserUploadResult, CRMUser, Department, UserRole } from "@/types/crm";
import { showToast } from "@/hooks/use-toast";

type PaginatedResponse<T> = { items: T[]; total: number; hasMore: boolean; nextOffset: number };
const BASE_ROLES: UserRole[] = ["EMPLOYEE", "INTERN", "MANAGER", "ADMIN"];

function StatusBanner({ message, variant }: { message: string; variant: "success" | "error" }) {
  const isError = variant === "error";
  return (
    <div role="alert" className="flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm font-medium sm:px-5" style={{ borderColor: isError ? "rgba(225,29,72,0.35)" : "rgba(16,185,129,0.35)", background: isError ? "rgba(225,29,72,0.06)" : "rgba(16,185,129,0.08)", color: isError ? "#be123c" : "#047857" }}>
      <span className="mt-0.5 shrink-0 text-base" aria-hidden>{isError ? "!" : "✓"}</span>
      <span>{message}</span>
    </div>
  );
}

const BULK_TEMPLATE = ["name,email,password,role,designation,department,managerEmail", "Aarav Sharma,aarav@planitt.com,TempPass@123,EMPLOYEE,Frontend Engineer,Engineering,manager@planitt.com", "Meera Singh,meera@planitt.com,TempPass@123,INTERN,Design Intern,Design,manager@planitt.com"].join("\n");

export default function EmployeesPage() {
  const { user, loading: sessionLoading, error: sessionError, retry: retrySession } = useSession({ allowedRoles: ["SUPERADMIN", "ADMIN", "MANAGER"] });
  const bulkInputRef = useRef<HTMLInputElement>(null);
  const [users, setUsers] = useState<CRMUser[]>([]);
  const [allUsers, setAllUsers] = useState<CRMUser[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [form, setForm] = useState<CreateMemberForm>({ name: "", email: "", password: "", role: "EMPLOYEE", designation: "", departmentId: "", managerId: "" });
  const [creating, setCreating] = useState(false);
  const [bulkFile, setBulkFile] = useState<File | null>(null);
  const [bulkUploading, setBulkUploading] = useState(false);
  const [bulkResult, setBulkResult] = useState<BulkUserUploadResult | null>(null);
  const [hasMoreUsers, setHasMoreUsers] = useState(false);
  const [nextUserOffset, setNextUserOffset] = useState(0);
  const [loadingMoreUsers, setLoadingMoreUsers] = useState(false);
  const [updatingId, setUpdatingId] = useState("");
  const [emailDrafts, setEmailDrafts] = useState<Record<string, string>>({});
  const [emailUpdatingId, setEmailUpdatingId] = useState("");
  const [deletingId, setDeletingId] = useState("");
  const [directorySearchQuery, setDirectorySearchQuery] = useState("");
  const [directoryRoleFilter, setDirectoryRoleFilter] = useState<MemberRoleFilter>("ALL");
  const { globalSearch, searchSubmitted } = useCrmSearch();

  const availableRoles: UserRole[] = user?.role === "SUPERADMIN" ? ["SUPERADMIN", ...BASE_ROLES] : BASE_ROLES;
  const createRoleOptions: UserRole[] = user?.role === "SUPERADMIN" ? ["SUPERADMIN", ...BASE_ROLES] : user?.role === "MANAGER" ? ["EMPLOYEE", "INTERN"] : BASE_ROLES;
  const directoryRoleOptions: UserRole[] = user?.role === "MANAGER" ? ["EMPLOYEE", "INTERN"] : availableRoles;
  const directoryRoleFilterOptions = useMemo(() => sortedUniqueRoles(users), [users]);
  const filteredDirectoryUsers = useMemo(() => filterMembersForPicker(users, { searchQuery: directorySearchQuery, roleFilter: directoryRoleFilter }), [users, directorySearchQuery, directoryRoleFilter]);

  useEffect(() => {
    if (!searchSubmitted) return;
    setDirectorySearchQuery(globalSearch.trim());
  }, [globalSearch, searchSubmitted]);

  const loadTeam = async (append = false) => {
    const offset = append ? nextUserOffset : 0;
    const [page, allMembers, depts] = await Promise.all([apiGet<PaginatedResponse<CRMUser>>(`/users?paginate=true&limit=25&offset=${offset}`), apiGet<CRMUser[]>("/users"), apiGet<Department[]>("/departments")]);
    setUsers((cur) => (append ? [...cur, ...page.items] : page.items));
    setAllUsers(allMembers); setHasMoreUsers(page.hasMore); setNextUserOffset(page.nextOffset); setDepartments(depts);
    setEmailDrafts(allMembers.reduce<Record<string, string>>((acc, m) => { acc[m.id] = m.email; return acc; }, {}));
  };

  useEffect(() => {
    if (!user) return;
    void loadTeam().catch((err) =>showToast(err instanceof Error ? err.message : "Failed to load employees" , "error")).finally(() => setDataLoading(false));
  }, [user]);

  useRealtimeRefresh(user, ["org:updated"], async () => { await loadTeam(); });

  const createEmployee = async () => {
    if (!user) return;
    try { setCreating(true); setError(""); setNotice(""); await apiPost("/users", { ...form }); setForm({ name: "", email: "", password: "", role: "EMPLOYEE", designation: "", departmentId: "", managerId: "" }); showToast("Team member created successfully." , "success"); await loadTeam(false); }
    catch (err) { showToast(err instanceof Error ? err.message : "Failed to create team member" , "error"); }
    finally { setCreating(false); }
  };

  const uploadBulkUsers = async () => {
    if (!bulkFile) { showToast("Choose a CSV file before uploading." , "error"); return; }
    try {
      setBulkUploading(true); setError(""); setNotice(""); setBulkResult(null);
      const fd = new FormData(); fd.append("file", bulkFile);
      const result = await apiPostForm<BulkUserUploadResult>("/users/bulk-upload", fd);
      setBulkResult(result); setNotice(result.failedCount ? `Created ${result.createdCount} members. ${result.failedCount} rows need attention.` : `Created ${result.createdCount} team members successfully.`);
      setBulkFile(null); if (bulkInputRef.current) bulkInputRef.current.value = "";
      await loadTeam(false);
    } catch (err) { showToast(err instanceof Error ? err.message : "Failed to bulk upload team members" ,"error"); }
    finally { setBulkUploading(false); }
  };

  const downloadBulkTemplate = () => {
    const blob = new Blob([BULK_TEMPLATE], { type: "text/csv;charset=utf-8;" }); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = "team-bulk-upload-template.csv"; a.click(); URL.revokeObjectURL(url);
  };

  const assignEmployee = async (member: CRMUser, field: "managerId" | "departmentId" | "role", value: string) => {
    try { setUpdatingId(member.id); setError(""); setNotice(""); const body: Record<string, string> = { designation: member.designation ?? "" }; body[field] = value; await apiPut(`/users/${member.id}/assignment`, body); await loadTeam(false); showToast("Assignment updated successfully." , "success"); }
    catch (err) { showToast(err instanceof Error ? err.message : "Failed to update assignment" , "error"); }
    finally { setUpdatingId(""); }
  };

  const updateMemberEmail = async (member: CRMUser) => {
    const next = emailDrafts[member.id]?.trim(); if (!next || next === member.email) return;
    try { setEmailUpdatingId(member.id); setError(""); setNotice(""); await apiPut(`/users/${member.id}/profile`, { email: next }); await loadTeam(false); showToast("Email updated successfully." , "success"); }
    catch (err) { showToast(err instanceof Error ? err.message : "Failed to update email" , "error"); }
    finally { setEmailUpdatingId(""); }
  };

  const deleteEmployee = async (member: CRMUser) => {
    if (!window.confirm(`Remove ${member.name} from the organisation? This cannot be undone.`)) return;
    try { setDeletingId(member.id); setError(""); setNotice(""); await apiDelete(`/users/${member.id}`); showToast("Team member removed." , "success"); await loadTeam(false); }
    catch (err) { showToast(err instanceof Error ? err.message : "Failed to delete team member" , "error"); }
    finally { setDeletingId(""); }
  };

  const managers = allUsers.filter((m) => ["SUPERADMIN", "ADMIN", "MANAGER"].includes(m.role));
  const peopleAnalytics = useMemo(() => {
    const total = allUsers.length; const employees = allUsers.filter((m) => m.role === "EMPLOYEE").length; const interns = allUsers.filter((m) => m.role === "INTERN").length;
    const leadership = allUsers.filter((m) => ["SUPERADMIN","ADMIN","MANAGER"].includes(m.role)).length;
    const assignedDept = allUsers.filter((m) => Boolean(m.department?.id)).length;
    return { total, employees, interns, leadership, departmentCoverage: total ? Math.round((assignedDept / total) * 100) : 0 };
  }, [allUsers]);

  const canBulkUpload = user?.role === "SUPERADMIN" || user?.role === "ADMIN";
  const canManageMemberRow = (m: CRMUser) => { if (!user) return false; if (user.role === "SUPERADMIN" || user.role === "ADMIN") return true; return m.manager?.id === user.id; };
  const canEditMemberEmail = (m: CRMUser) => canManageMemberRow(m) && !(m.role === "SUPERADMIN" && user?.role !== "SUPERADMIN");
  const canDeleteMember = (m: CRMUser) => { if (!user || m.id === user.id) return false; if (m.role === "SUPERADMIN" && user.role !== "SUPERADMIN") return false; if (user.role === "MANAGER") return Boolean(m.manager?.id === user.id && ["EMPLOYEE","INTERN"].includes(m.role)); return user.role === "SUPERADMIN" || user.role === "ADMIN"; };
  const hasLeadershipLinks = (m: CRMUser) => ["EMPLOYEE","INTERN"].includes(m.role) && (m.manager?.role === "ADMIN" || m.manager?.role === "MANAGER");

  const sessionGate = renderSessionGate({ loading: sessionLoading, user, error: sessionError, retry: retrySession, loadingTitle: "Loading team workspace", loadingDescription: "Fetching access and employee data." });
  if (sessionGate) return sessionGate;
  if (!user) return null;
   if (dataLoading) {
    return (
      <CRMShell user={user}>
        <EmployeesSkeleton />
      </CRMShell>
    );
  }

  return (
    <CRMShell user={user}>
      <div className="min-w-0 space-y-5 overflow-x-hidden pb-4">
        <section className="relative overflow-hidden rounded-2xl border p-5 sm:p-6" style={{ background: "linear-gradient(135deg, color-mix(in srgb, var(--surface) 88%, var(--accent-strong)), var(--surface))", borderColor: "var(--border)", boxShadow: "var(--shadow-soft)" }}>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--text-faint)]">Team control</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-[var(--text-main)] sm:text-3xl">Employees & interns</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[var(--text-soft)]">Create members, assign departments, and connect people to their reporting managers. Edits save immediately.</p>
          <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-5">
            {[{ label: "Total members", value: peopleAnalytics.total }, { label: "Employees", value: peopleAnalytics.employees }, { label: "Interns", value: peopleAnalytics.interns }, { label: "Leadership", value: peopleAnalytics.leadership }, { label: "Dept coverage", value: `${peopleAnalytics.departmentCoverage}%` }].map((item) => (
              <div key={item.label} className="rounded-xl border px-3 py-2.5 sm:rounded-2xl sm:px-4 sm:py-3" style={{ borderColor: "var(--border)", background: "color-mix(in srgb, var(--surface) 70%, white)" }}>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-faint)] sm:text-[11px]">{item.label}</p>
                <p className="mt-1 text-lg font-semibold tabular-nums text-[var(--text-main)] sm:text-xl">{item.value}</p>
              </div>
            ))}
          </div>
        </section>
        {error ? <StatusBanner variant="error" message={error} /> : null}
        {notice ? <StatusBanner variant="success" message={notice} /> : null}
        <div className="grid gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] xl:items-start">
          <div className="flex min-w-0 flex-col gap-5 xl:sticky xl:top-4">
            <CreateMemberPanel
              form={form} onFormChange={(field, value) => setForm((cur) => ({ ...cur, [field]: value }))}
              creating={creating} onSubmit={() => void createEmployee()} createRoleOptions={createRoleOptions}
              canBulkUpload={canBulkUpload} bulkFile={bulkFile} bulkUploading={bulkUploading} bulkResult={bulkResult}
              onBulkFileChange={setBulkFile} onBulkUpload={() => void uploadBulkUsers()} onDownloadTemplate={downloadBulkTemplate}
              bulkInputRef={bulkInputRef} onSetError={setError} departments={departments} managers={managers}
            />
          </div>
          <MemberRoster
            users={users} filteredUsers={filteredDirectoryUsers} departments={departments} managers={managers}
            dataLoading={dataLoading} hasMore={hasMoreUsers} loadingMore={loadingMoreUsers}
            directoryRoleOptions={directoryRoleOptions} emailDrafts={emailDrafts}
            updatingId={updatingId} emailUpdatingId={emailUpdatingId} deletingId={deletingId}
            searchQuery={directorySearchQuery} onSearchChange={setDirectorySearchQuery}
            roleFilter={directoryRoleFilter} onRoleFilterChange={setDirectoryRoleFilter} roleFilterOptions={directoryRoleFilterOptions}
            canManageRow={canManageMemberRow} canEditEmail={canEditMemberEmail} canDelete={canDeleteMember} hasLeadershipLinks={hasLeadershipLinks}
            onEmailDraftChange={(id, email) => setEmailDrafts((cur) => ({ ...cur, [id]: email }))}
            onAssign={(m, field, value) => void assignEmployee(m, field, value)}
            onEmailUpdate={(m) => void updateMemberEmail(m)} onDelete={(m) => void deleteEmployee(m)}
            onLoadMore={() => { setLoadingMoreUsers(true); void loadTeam(true).finally(() => setLoadingMoreUsers(false)); }}
            currentUserId={user.id} currentUserRole={user.role}
          />
        </div>
      </div>
    </CRMShell>
  );
}
