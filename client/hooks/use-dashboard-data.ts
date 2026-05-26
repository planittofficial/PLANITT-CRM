"use client";

import { useEffect, useMemo, useState } from "react";
import { useCrmSearch } from "@/components/providers/crm-search-provider";
import { filterMembersForPicker, sortedUniqueRoles, type MemberRoleFilter } from "@/components/shared/member-picker-toolbar";
import { useRealtimeRefresh } from "@/hooks/use-realtime-refresh";
import { useSession } from "@/hooks/use-session";
import { apiDelete, apiGet, apiPost } from "@/lib/api";
import { normalizeErrorMessage } from "@/lib/error-message";
import type { CRMUser, DashboardSummary, EmployeeDashboardSummary, GoogleDriveFolderResult, GoogleMeetSessionResult, GoogleProjectSheetResult, GoogleWorkspaceStatus, Project, UserAnalyticsSummary } from "@/types/crm";

export type WorkspaceActionLoading = "" | "meet" | "sheets" | "drive";
const TEAM_ANALYTICS_PRELOAD_LIMIT = 8;

function workspaceAssetsStorageKey(userId: string) { return `crm-workspace-assets:${userId}`; }
export function canUseGoogleWorkspace(scope: DashboardSummary["scope"]) { return scope === "superadmin" || scope === "admin"; }

export function useDashboardData() {
  const session = useSession();
  const { user, loading, error: sessionError, retry: retrySession } = session;
  const { globalSearch, setGlobalSearch ,  searchSubmitted,
 resetSearch,} = useCrmSearch();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [teamMembers, setTeamMembers] = useState<CRMUser[]>([]);
  const [teamDirectoryRoleFilter, setTeamDirectoryRoleFilter] = useState<MemberRoleFilter>("ALL");
  const [selectedMemberId, setSelectedMemberId] = useState("");
  const [selectedAnalytics, setSelectedAnalytics] = useState<UserAnalyticsSummary | null>(null);
  const [teamAnalyticsList, setTeamAnalyticsList] = useState<UserAnalyticsSummary[]>([]);
  const [teamLoading, setTeamLoading] = useState(false);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [workspaceStatus, setWorkspaceStatus] = useState<GoogleWorkspaceStatus | null>(null);
  const [workspaceProjects, setWorkspaceProjects] = useState<Project[]>([]);
  const [workspaceUsers, setWorkspaceUsers] = useState<CRMUser[]>([]);
  const [selectedWorkspaceProjectId, setSelectedWorkspaceProjectId] = useState("");
  const [workspaceActionLoading, setWorkspaceActionLoading] = useState<WorkspaceActionLoading>("");
  const [meetResult, setMeetResult] = useState<GoogleMeetSessionResult | null>(null);
  const [sheetResult, setSheetResult] = useState<GoogleProjectSheetResult | null>(null);
  const [driveResult, setDriveResult] = useState<GoogleDriveFolderResult | null>(null);
  const [workspaceLoading, setWorkspaceLoading] = useState(false);
  const [workspaceMessage, setWorkspaceMessage] = useState("");
  const [activeDashboardTab, setActiveDashboardTab] = useState<"analytics" | "workspace">("analytics");
  const [error, setError] = useState("");

  const leadershipView = summary?.scope === "admin" || summary?.scope === "superadmin";
  const teamDirectoryRoleOptions = useMemo(() => sortedUniqueRoles(teamMembers), [teamMembers]);
  const filteredTeamMembers = useMemo(() => filterMembersForPicker(teamMembers, { searchQuery:  searchSubmitted ? globalSearch : "", roleFilter: teamDirectoryRoleFilter }), [teamMembers, globalSearch,searchSubmitted, teamDirectoryRoleFilter]);

  useEffect(() => {
    if (!leadershipView) return;
    setSelectedMemberId((cur) => { if (filteredTeamMembers.some((m) => m.id === cur)) return cur; return filteredTeamMembers[0]?.id ?? ""; });
  }, [leadershipView, filteredTeamMembers]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const p = new URLSearchParams(window.location.search);
    if (p.get("tab") === "workspace") setActiveDashboardTab("workspace");
    const g = p.get("google");
    if (g === "connected") setWorkspaceMessage("Google Workspace connected successfully.");
    else if (g === "denied") setWorkspaceMessage("Google connection was cancelled from consent screen.");
    else if (g === "missing_config") setWorkspaceMessage("Google OAuth config is missing in backend environment.");
    else if (g === "token_failed" || g === "failed") setWorkspaceMessage("Google token exchange failed. Please retry connection.");
    else if (g === "missing_code") setWorkspaceMessage("Google callback was incomplete. Please retry.");
  }, []);

  useEffect(() => {
    if (!user) return;
    const raw = window.localStorage.getItem(workspaceAssetsStorageKey(user.id));
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as { meetResult?: GoogleMeetSessionResult | null; sheetResult?: GoogleProjectSheetResult | null; driveResult?: GoogleDriveFolderResult | null };
      setMeetResult(parsed.meetResult ?? null);
      setSheetResult(parsed.sheetResult ?? null);
      setDriveResult(parsed.driveResult ?? null);
    } catch { setMeetResult(null); setSheetResult(null); setDriveResult(null); }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    window.localStorage.setItem(workspaceAssetsStorageKey(user.id), JSON.stringify({ meetResult, sheetResult, driveResult }));
  }, [user, meetResult, sheetResult, driveResult]);

  useEffect(() => {
    async function loadSummary() {
      try { const d = await apiGet<DashboardSummary>("/dashboard/summary"); setSummary(d); setError(""); }
      catch (err) { setError(normalizeErrorMessage(err, "Failed to load dashboard")); }
    }
    if (user) void loadSummary();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const onLocalAttendanceUpdate = () => {
      void apiGet<DashboardSummary>("/dashboard/summary")
        .then((d) => {
          setSummary(d);
          setError("");
        })
        .catch((err) => setError(normalizeErrorMessage(err, "Failed to refresh dashboard")));
    };

    window.addEventListener("attendance:local-updated", onLocalAttendanceUpdate);
    return () => {
      window.removeEventListener("attendance:local-updated", onLocalAttendanceUpdate);
    };
  }, [user]);

  useEffect(() => {
    async function loadTeam() {
      if (!leadershipView) { setTeamAnalyticsList([]); return; }
      try {
        setTeamLoading(true);
        const page = await apiGet<{ items: CRMUser[] }>("/users?paginate=true&limit=120&offset=0");
        const visible = summary?.scope === "superadmin"
          ? page.items.filter((m) => ["ADMIN","MANAGER","EMPLOYEE","INTERN"].includes(m.role))
          : page.items.filter((m) => m.role === "EMPLOYEE" || m.role === "INTERN");
        setTeamMembers(visible);
        setSelectedMemberId((c) => c || visible[0]?.id || "");
        void Promise.all(
          visible
            .slice(0, TEAM_ANALYTICS_PRELOAD_LIMIT)
            .map((m) => apiGet<UserAnalyticsSummary>(`/users/${m.id}/analytics`))
        )
          .then((analyticsData) => setTeamAnalyticsList(analyticsData))
          .catch(() => {});
      } catch (err) { setError(normalizeErrorMessage(err, "Failed to load team members")); }
      finally { setTeamLoading(false);
        resetSearch();
       }
    }
    void loadTeam();
  }, [leadershipView, summary?.scope]);

  useEffect(() => {
    async function loadAnalytics() {
      if (!leadershipView || !selectedMemberId) { setSelectedAnalytics(null); return; }
      try {
        setAnalyticsLoading(true);
        const d = await apiGet<UserAnalyticsSummary>(`/users/${selectedMemberId}/analytics`);
        setSelectedAnalytics(d);
      } catch (err) { setError(normalizeErrorMessage(err, "Failed to load member analytics")); }
      finally { setAnalyticsLoading(false); }
    }
    void loadAnalytics();
  }, [leadershipView, selectedMemberId]);

  useEffect(() => {
    async function loadWorkspace() {
      if (!summary || !canUseGoogleWorkspace(summary.scope)) { setWorkspaceStatus(null); setWorkspaceProjects([]); setWorkspaceUsers([]); setSelectedWorkspaceProjectId(""); return; }
      try {
        setWorkspaceLoading(true);
        const [status, pPage, uPage] = await Promise.all([apiGet<GoogleWorkspaceStatus>("/integrations/google/status"), apiGet<{ items: Project[] }>("/projects?paginate=true&limit=100&offset=0"), apiGet<{ items: CRMUser[] }>("/users?paginate=true&limit=120&offset=0")]);
        setWorkspaceStatus(status); setWorkspaceProjects(pPage.items); setWorkspaceUsers(uPage.items);
        setSelectedWorkspaceProjectId((c) => c || pPage.items[0]?.id || "");
      } catch (err) { setWorkspaceStatus(null); setWorkspaceProjects([]); setWorkspaceUsers([]); setWorkspaceMessage(normalizeErrorMessage(err, "Failed to load Google Workspace status")); }
      finally { setWorkspaceLoading(false); }
    }
    void loadWorkspace();
  }, [summary?.scope]);

  useRealtimeRefresh(user, ["task:updated", "attendance:updated", "org:updated", "issue:updated", "project:updated"], async () => {
    if (!user) return;
    const fresh = await apiGet<DashboardSummary>("/dashboard/summary");
    setSummary(fresh);
    if (fresh.scope === "admin" || fresh.scope === "superadmin") {
      const membersPage = await apiGet<{ items: CRMUser[] }>("/users?paginate=true&limit=120&offset=0");
      const visible = fresh.scope === "superadmin" ? membersPage.items.filter((m) => ["ADMIN","MANAGER","EMPLOYEE","INTERN"].includes(m.role)) : membersPage.items.filter((m) => m.role === "EMPLOYEE" || m.role === "INTERN");
      setTeamMembers(visible);
      void Promise.all(
        visible
          .slice(0, TEAM_ANALYTICS_PRELOAD_LIMIT)
          .map((m) => apiGet<UserAnalyticsSummary>(`/users/${m.id}/analytics`))
      )
        .then((analyticsList) => setTeamAnalyticsList(analyticsList))
        .catch(() => {});
      const nextId = visible.find((m) => m.id === selectedMemberId)?.id ?? visible[0]?.id ?? "";
      setSelectedMemberId(nextId);
      if (nextId) {
        void apiGet<UserAnalyticsSummary>(`/users/${nextId}/analytics`)
          .then((data) => setSelectedAnalytics(data))
          .catch(() => {});
      }
    }
    if (canUseGoogleWorkspace(fresh.scope)) {
      try {
        const [ws, pPage, uPage] = await Promise.all([apiGet<GoogleWorkspaceStatus>("/integrations/google/status"), apiGet<{ items: Project[] }>("/projects?paginate=true&limit=100&offset=0"), apiGet<{ items: CRMUser[] }>("/users?paginate=true&limit=120&offset=0")]);
        setWorkspaceStatus(ws); setWorkspaceProjects(pPage.items); setWorkspaceUsers(uPage.items);
        setSelectedWorkspaceProjectId((c) => c || pPage.items[0]?.id || "");
      } catch (err) { setWorkspaceStatus(null); setWorkspaceProjects([]); setWorkspaceUsers([]); setWorkspaceMessage(normalizeErrorMessage(err, "Failed to refresh Google Workspace status")); }
    } else { setTeamAnalyticsList([]); setWorkspaceStatus(null); setWorkspaceProjects([]); setWorkspaceUsers([]); }
  });

  const handleGoogleConnect = async () => {
    try { const d = await apiGet<{ authUrl: string }>("/integrations/google/auth-url?services=meet,sheets,drive"); window.location.href = d.authUrl; }
    catch (err) { setWorkspaceMessage(normalizeErrorMessage(err, "Failed to start Google Auth flow.")); }
  };

  const handleGoogleDisconnect = async () => {
    try {
      await apiDelete<void>("/integrations/google/disconnect");
      setWorkspaceMessage("Google Workspace disconnected.");
      setMeetResult(null); setSheetResult(null); setDriveResult(null);
      const refreshed = await apiGet<GoogleWorkspaceStatus>("/integrations/google/status");
      setWorkspaceStatus(refreshed);
    } catch (err) { setWorkspaceMessage(normalizeErrorMessage(err, "Failed to disconnect Google Workspace.")); }
  };

  const runWorkspaceAction = async (service: WorkspaceActionLoading, attendeeUserIds: string[] = []) => {
    if ((service === "sheets" || service === "drive") && !selectedWorkspaceProjectId) { setWorkspaceMessage("Pick a project before creating a Google Workspace asset."); return; }
    try {
      setWorkspaceActionLoading(service); setWorkspaceMessage("");
      if (service === "meet") { const r = await apiPost<GoogleMeetSessionResult>("/integrations/google/meet/session", { projectId: selectedWorkspaceProjectId || undefined, attendeeUserIds }); setMeetResult(r); setWorkspaceMessage(`Meet session created${r.project?.name ? ` for ${r.project.name}` : ""}.`); }
      if (service === "sheets") { const r = await apiPost<GoogleProjectSheetResult>("/integrations/google/sheets/project-report", { projectId: selectedWorkspaceProjectId }); setSheetResult(r); setWorkspaceMessage(`Project report exported to Google Sheets for ${r.project.name}.`); }
      if (service === "drive") { const r = await apiPost<GoogleDriveFolderResult>("/integrations/google/drive/project-folder", { projectId: selectedWorkspaceProjectId }); setDriveResult(r); setWorkspaceMessage(`Drive workspace created for ${r.project.name}.`); }
    } catch (err) { setWorkspaceMessage(normalizeErrorMessage(err, "Google Workspace action failed.")); }
    finally { setWorkspaceActionLoading(""); }
  };

  const overviewStats = useMemo(() => {
    if (!summary) return [];
    const progressSeries = summary.analytics.taskProgressTrend.map((x) => x.avgProgress);
    const attendanceSeries = summary.scope === "employee" ? summary.analytics.workingHoursTrend.map((x) => x.hours) : summary.analytics.attendanceHeatmap.map((x) => x.value);
    const hoursSeries = summary.analytics.workingHoursTrend.map((x) => x.hours);
    if (summary.scope === "superadmin") return [
      { label: "Departments", value: summary.metrics.totalDepartments, helper: "Active business units", points: attendanceSeries.slice(-7) },
      { label: "Managers", value: summary.metrics.totalManagers, helper: "Leadership coverage", points: progressSeries.slice(-7) },
      { label: "Employees", value: summary.metrics.totalEmployees, helper: "Core execution team", points: hoursSeries.slice(-7) },
      { label: "Interns", value: summary.metrics.totalInterns, helper: "Learning pipeline", points: progressSeries.slice(-7).reverse() },
    ];
    if (summary.scope === "admin") return [
      { label: "Employees", value: summary.metrics.totalEmployees, helper: "Employees and managers", points: attendanceSeries.slice(-7) },
      { label: "Interns", value: summary.metrics.totalInterns, helper: "Current intern roster", points: hoursSeries.slice(-7) },
      { label: "Tasks", value: summary.metrics.totalTasks, helper: "Tracked organization tasks", points: progressSeries.slice(-7) },
      { label: "Live attendance", value: summary.metrics.activeAttendance, helper: "Checked in right now", points: attendanceSeries.slice(-7).reverse() },
    ];
    const em = (summary as EmployeeDashboardSummary).metrics;
    return [
      { label: "Assigned", value: em.myTasks, helper: "Tasks in your queue", points: progressSeries.slice(-7) },
      { label: "Pending", value: em.pendingTasks, helper: "Open work items", points: attendanceSeries.slice(-7) },
      { label: "Done", value: em.completedTasks, helper: "Completed items", points: progressSeries.slice(-7).reverse() },
      { label: "Status", value: em.checkedIn ? "Active" : "Offline", helper: "Attendance state", points: hoursSeries.slice(-7) },
    ];
  }, [summary]);

  return {
    user, loading, error, sessionError, retrySession, summary, teamMembers, teamLoading, analyticsLoading, selectedMemberId, selectedAnalytics, teamAnalyticsList, teamDirectoryRoleFilter, teamDirectoryRoleOptions, filteredTeamMembers, overviewStats, leadershipView, globalSearch, setGlobalSearch, setTeamDirectoryRoleFilter, setSelectedMemberId,
    workspaceStatus, workspaceProjects, workspaceUsers, selectedWorkspaceProjectId, workspaceActionLoading, meetResult, sheetResult, driveResult, workspaceLoading, workspaceMessage, activeDashboardTab, setActiveDashboardTab, setMeetResult, setSheetResult, setDriveResult,
    setSelectedWorkspaceProjectId, setWorkspaceMessage, handleGoogleConnect, handleGoogleDisconnect, runWorkspaceAction,
  };
}
