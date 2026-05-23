"use client";

import { useEffect, useMemo, useState } from "react";
import { filterMembersForPicker, sortedUniqueRoles, type MemberRoleFilter } from "@/components/shared/member-picker-toolbar";
import { useRealtimeRefresh } from "@/hooks/use-realtime-refresh";
import { useSession } from "@/hooks/use-session";
import { apiDelete, apiGet, apiPost, apiPut } from "@/lib/api";
import { groupTasksByAssignees } from "@/lib/task-groups";
import { TASK_PRIORITY_OPTIONS } from "@/lib/task-groups";
import { renderSessionGate } from "@/components/shared/session-gate";
import type { CRMUser, Department, Project, Task, TaskPriority, UserRole } from "@/types/crm";

export { TASK_PRIORITY_OPTIONS };

type PaginatedResponse<T> = { items: T[]; total: number; hasMore: boolean; nextOffset: number };
const PROJECT_MEMBER_ROLES: UserRole[] = ["ADMIN", "MANAGER", "EMPLOYEE", "INTERN"];

export type TaskFormState = { title: string; description: string; userIds: string[]; checklistText: string; priority: TaskPriority; deadlineAt: string };
const EMPTY_TASK_FORM: TaskFormState = { title: "", description: "", userIds: [], checklistText: "", priority: "MEDIUM", deadlineAt: "" };

export function useProjectsData() {
  const { user, loading: sessionLoading, error: sessionError, retry: retrySession } = useSession({ allowedRoles: ["SUPERADMIN", "ADMIN", "MANAGER"] });
  const [projects, setProjects] = useState<Project[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [team, setTeam] = useState<CRMUser[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [loading, setLoading] = useState(true);
  const [hasMoreProjects, setHasMoreProjects] = useState(false);
  const [nextProjectOffset, setNextProjectOffset] = useState(0);
  const [loadingMoreProjects, setLoadingMoreProjects] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [creatingProject, setCreatingProject] = useState(false);
  const [creatingTask, setCreatingTask] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState("");
  const [projectForm, setProjectForm] = useState({ name: "", description: "", departmentId: "", ownerId: "" });
  const [taskForm, setTaskForm] = useState<TaskFormState>(EMPTY_TASK_FORM);
  const [editTaskForm, setEditTaskForm] = useState<TaskFormState>(EMPTY_TASK_FORM);
  const [projectAssignQuery, setProjectAssignQuery] = useState("");
  const [projectAssignRole, setProjectAssignRole] = useState<MemberRoleFilter>("ALL");
  const [projectTeamQuery, setProjectTeamQuery] = useState("");
  const [projectTeamRole, setProjectTeamRole] = useState<MemberRoleFilter>("ALL");
  const [projectMemberDraftIds, setProjectMemberDraftIds] = useState<string[]>([]);
  const [savingProjectMembers, setSavingProjectMembers] = useState(false);
  const [metaLoaded, setMetaLoaded] = useState(false);

  const fieldStyle = { borderColor: "var(--border)", background: "var(--surface-soft)", color: "var(--text-main)" } as const;

  const loadProjectMeta = async () => {
    const [depts, users] = await Promise.all([apiGet<Department[]>("/departments"), apiGet<CRMUser[]>("/users")]);
    setDepartments(depts);
    setTeam(users);
    setMetaLoaded(true);
  };

  const loadProjects = async (append = false) => {
    const offset = append ? nextProjectOffset : 0;
    const page = await apiGet<PaginatedResponse<Project>>(`/projects?paginate=true&limit=20&offset=${offset}`);
    setProjects((cur) => (append ? [...cur, ...page.items] : page.items));
    setHasMoreProjects(page.hasMore);
    setNextProjectOffset(page.nextOffset);
    if (!selectedProjectId && page.items[0]) setSelectedProjectId(page.items[0].id);
  };

  const loadProjectTasks = async (projectId: string) => {
    const data = await apiGet<Task[]>(`/tasks?projectId=${projectId}`);
    setTasks(data);
  };

  useEffect(() => {
    if (!user) return;
    async function boot() {
      try {
        setError("");
        await Promise.all([loadProjects(false), loadProjectMeta()]);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load projects");
      } finally {
        setLoading(false);
      }
    }
    void boot();
  }, [user]);

  useEffect(() => { if (!selectedProjectId) { setTasks([]); return; } void loadProjectTasks(selectedProjectId); }, [selectedProjectId]);

  useRealtimeRefresh(user, ["project:updated", "task:updated", "org:updated"], async () => {
    await loadProjects();
    if (!metaLoaded) {
      await loadProjectMeta();
    }
    if (selectedProjectId) await loadProjectTasks(selectedProjectId);
  });

  const selectedProject = useMemo(() => projects.find((p) => p.id === selectedProjectId) ?? null, [projects, selectedProjectId]);

  const departmentMembersForProject = useMemo(() => {
    if (!selectedProject) return [];
    return team.filter((m) => m.departmentId === selectedProject.departmentId && PROJECT_MEMBER_ROLES.includes(m.role));
  }, [team, selectedProject]);

  const taskAssigneePickerSource = useMemo(() => {
    if (!selectedProject) return team;
    const roster = selectedProject.members ?? [];
    if (!roster.length) return team;
    const allowed = new Set(roster.map((row) => row.user.id));
    return team.filter((m) => allowed.has(m.id));
  }, [selectedProject, team]);

  const projectAssignRoleOptions = useMemo(() => sortedUniqueRoles(taskAssigneePickerSource.filter((m) => PROJECT_MEMBER_ROLES.includes(m.role))), [taskAssigneePickerSource]);
  const filteredProjectAssignees = useMemo(() => filterMembersForPicker(taskAssigneePickerSource, { searchQuery: projectAssignQuery, roleFilter: projectAssignRole, restrictToRoles: PROJECT_MEMBER_ROLES }), [taskAssigneePickerSource, projectAssignQuery, projectAssignRole]);
  const projectTeamRoleOptions = useMemo(() => sortedUniqueRoles(departmentMembersForProject), [departmentMembersForProject]);
  const filteredProjectTeamRoster = useMemo(() => filterMembersForPicker(departmentMembersForProject, { searchQuery: projectTeamQuery, roleFilter: projectTeamRole, restrictToRoles: PROJECT_MEMBER_ROLES }), [departmentMembersForProject, projectTeamQuery, projectTeamRole]);

  const rosterSig = selectedProject?.members?.map((m) => m.user.id).join(",") ?? "";
  useEffect(() => { if (!selectedProject) { setProjectMemberDraftIds([]); return; } setProjectMemberDraftIds(selectedProject.members?.map((r) => r.user.id) ?? []); }, [selectedProject?.id, rosterSig]);
  useEffect(() => {
    if (!selectedProject) return;
    const roster = selectedProject.members ?? [];
    if (!roster.length) return;
    const allowed = new Set(roster.map((r) => r.user.id));
    setTaskForm((cur) => ({ ...cur, userIds: cur.userIds.filter((id) => allowed.has(id)) }));
    setEditTaskForm((cur) => ({ ...cur, userIds: cur.userIds.filter((id) => allowed.has(id)) }));
  }, [selectedProject?.id, rosterSig]);

  const groupedTasks = useMemo(() => ({ TODO: tasks.filter((t) => t.status === "TODO"), IN_PROGRESS: tasks.filter((t) => t.status === "IN_PROGRESS"), DONE: tasks.filter((t) => t.status === "DONE") }), [tasks]);

  const projectAnalytics = useMemo(() => {
    const total = projects.length;
    const avg = total ? Math.round(projects.reduce((s, p) => s + p.progress, 0) / total) : 0;
    const totalTasks = projects.reduce((s, p) => s + p.taskCounts.total, 0);
    const done = projects.reduce((s, p) => s + p.taskCounts.done, 0);
    return { totalProjects: total, avgProgress: avg, totalTasks, completionRate: totalTasks ? Math.round((done / totalTasks) * 100) : 0, delayedProjects: projects.filter((p) => p.progress < 40 && p.taskCounts.total >= 3).length };
  }, [projects]);

  const createProject = async () => {
    try { setCreatingProject(true); setError(""); setNotice(""); const p = await apiPost<Project>("/projects", projectForm); setProjectForm({ name: "", description: "", departmentId: "", ownerId: "" }); setSelectedProjectId(p.id); setNotice("Project created successfully."); await loadProjects(false); }
    catch (err) { setError(err instanceof Error ? err.message : "Failed to create project"); }
    finally { setCreatingProject(false); }
  };

  const createTask = async () => {
    if (!selectedProjectId) return;
    try {
      setCreatingTask(true); setError(""); setNotice("");
      await apiPost("/tasks", { ...taskForm, deadlineAt: taskForm.deadlineAt || null, projectId: selectedProjectId, checklistItems: taskForm.checklistText.split("\n").map((x) => x.trim()).filter(Boolean) });
      setTaskForm(EMPTY_TASK_FORM); setNotice("Task added to project."); await loadProjectTasks(selectedProjectId); await loadProjects(false);
    } catch (err) { setError(err instanceof Error ? err.message : "Failed to create project task"); }
    finally { setCreatingTask(false); }
  };

  const updateTaskStatus = async (taskId: string, status: Task["status"]) => {
    try { await apiPut(`/tasks/${taskId}`, { status }); if (selectedProjectId) await loadProjectTasks(selectedProjectId); await loadProjects(false); }
    catch (err) { setError(err instanceof Error ? err.message : "Failed to move task"); }
  };

  const updateTaskPriority = async (taskId: string, priority: TaskPriority) => {
    try { await apiPut(`/tasks/${taskId}`, { priority }); if (selectedProjectId) await loadProjectTasks(selectedProjectId); await loadProjects(false); }
    catch (err) { setError(err instanceof Error ? err.message : "Failed to update priority"); }
  };

  const openTaskEditor = (task: Task) => {
    const localDeadline = task.deadlineAt
      ? (() => {
          const date = new Date(task.deadlineAt);
          const offset = date.getTimezoneOffset();
          return new Date(date.getTime() - offset * 60000).toISOString().slice(0, 16);
        })()
      : "";
    setEditingTaskId(task.id);
    setEditTaskForm({ title: task.title, description: task.description ?? "", userIds: task.assignments.map((a) => a.userId), checklistText: task.checklistItems.map((x) => x.title).join("\n"), priority: task.priority ?? "MEDIUM", deadlineAt: localDeadline });
  };

  const saveTaskEdits = async () => {
    if (!editingTaskId) return;
    try {
      setError(""); setNotice("");
      await apiPut(`/tasks/${editingTaskId}`, { ...editTaskForm, deadlineAt: editTaskForm.deadlineAt || null, checklistItems: editTaskForm.checklistText.split("\n").map((x) => x.trim()).filter(Boolean) });
      setEditingTaskId(""); setNotice("Task updated successfully.");
      if (selectedProjectId) await loadProjectTasks(selectedProjectId); await loadProjects();
    } catch (err) { setError(err instanceof Error ? err.message : "Failed to update task"); }
  };

  const deleteTask = async (taskId: string) => {
    if (!window.confirm("Delete this task permanently?")) return;
    try { setError(""); setNotice(""); await apiDelete(`/tasks/${taskId}`); if (editingTaskId === taskId) setEditingTaskId(""); setNotice("Task deleted successfully."); if (selectedProjectId) await loadProjectTasks(selectedProjectId); await loadProjects(); }
    catch (err) { setError(err instanceof Error ? err.message : "Failed to delete task"); }
  };

  const saveProjectMembers = async () => {
    if (!selectedProjectId) return;
    try { setSavingProjectMembers(true); setError(""); setNotice(""); await apiPut(`/projects/${selectedProjectId}/members`, { memberUserIds: projectMemberDraftIds }); setNotice("Project team updated."); await loadProjects(false); }
    catch (err) { setError(err instanceof Error ? err.message : "Failed to update project team"); }
    finally { setSavingProjectMembers(false); }
  };

  const sessionGate = renderSessionGate({ loading: sessionLoading, user, error: sessionError, retry: retrySession, loadingTitle: "Loading projects", loadingDescription: "Preparing the project workspace." });

  return {
    user, loading, error, notice, sessionGate, projects, departments, team, tasks, selectedProjectId, setSelectedProjectId,
    hasMoreProjects, loadingMoreProjects, setLoadingMoreProjects, loadProjects, projectForm, setProjectForm, creatingProject, createProject,
    taskForm, setTaskForm, editTaskForm, setEditTaskForm, editingTaskId, setEditingTaskId, creatingTask, createTask,
    updateTaskStatus, updateTaskPriority, openTaskEditor, saveTaskEdits, deleteTask,
    projectAssignQuery, setProjectAssignQuery, projectAssignRole, setProjectAssignRole, projectAssignRoleOptions, filteredProjectAssignees,
    projectTeamQuery, setProjectTeamQuery, projectTeamRole, setProjectTeamRole, projectTeamRoleOptions, filteredProjectTeamRoster,
    projectMemberDraftIds, toggleProjectMemberDraft: (id: string) => setProjectMemberDraftIds((cur) => cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]),
    savingProjectMembers, saveProjectMembers, groupedTasks, projectAnalytics, selectedProject, fieldStyle,
    departmentMembersForProject,
  };
}
