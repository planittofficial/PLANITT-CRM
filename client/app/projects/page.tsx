"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { CRMShell } from "@/components/layout/crm-shell";
import { MemberPickerToolbar, filterMembersForPicker, sortedUniqueRoles, type MemberRoleFilter } from "@/components/shared/member-picker-toolbar";
import { StatePanel } from "@/components/shared/state-panel";
import { renderSessionGate } from "@/components/shared/session-gate";
import { useRealtimeRefresh } from "@/hooks/use-realtime-refresh";
import { useSession } from "@/hooks/use-session";
import { apiDelete, apiGet, apiPost, apiPut } from "@/lib/api";
import { getTaskAssignableRoles } from "@/lib/dashboard";
import { TASK_PRIORITY_OPTIONS, groupTasksByAssignees } from "@/lib/task-groups";
import type { CRMUser, Department, Project, Task, TaskPriority } from "@/types/crm";
type PaginatedResponse<T> = { items: T[]; total: number; hasMore: boolean; nextOffset: number };

const columns: Array<{ key: Task["status"]; label: string; tone: string }> = [
  { key: "TODO", label: "Pending", tone: "bg-rose-500" },
  { key: "IN_PROGRESS", label: "In Progress", tone: "bg-amber-500" },
  { key: "DONE", label: "Completed", tone: "bg-emerald-500" },
];

function Surface({ children }: { children: ReactNode }) {
  return (
    <section
      className="rounded-[20px] border p-5"
      style={{
        background: "var(--surface)",
        borderColor: "var(--border)",
        boxShadow: "var(--shadow-soft)",
      }}
    >
      {children}
    </section>
  );
}

export default function ProjectsPage() {
  const { user, loading: sessionLoading, error: sessionError, retry: retrySession } = useSession({
    allowedRoles: ["SUPERADMIN", "ADMIN", "MANAGER"],
  });
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
  const [projectForm, setProjectForm] = useState({
    name: "",
    description: "",
    departmentId: "",
    ownerId: "",
  });
  const [taskForm, setTaskForm] = useState({
    title: "",
    description: "",
    userIds: [] as string[],
    checklistText: "",
    priority: "MEDIUM" as TaskPriority,
  });
  const [editTaskForm, setEditTaskForm] = useState({
    title: "",
    description: "",
    userIds: [] as string[],
    checklistText: "",
    priority: "MEDIUM" as TaskPriority,
  });
  const [projectAssignQuery, setProjectAssignQuery] = useState("");
  const [projectAssignRole, setProjectAssignRole] = useState<MemberRoleFilter>("ALL");
  const [projectTeamQuery, setProjectTeamQuery] = useState("");
  const [projectTeamRole, setProjectTeamRole] = useState<MemberRoleFilter>("ALL");
  const [projectMemberDraftIds, setProjectMemberDraftIds] = useState<string[]>([]);
  const [savingProjectMembers, setSavingProjectMembers] = useState(false);

  const fieldStyle = {
    borderColor: "var(--border)",
    background: "var(--surface-soft)",
    color: "var(--text-main)",
  } as const;

  const assignableRoles = useMemo(
    () => (user ? getTaskAssignableRoles(user.role) : []),
    [user]
  );
  const loadProjects = async (append = false) => {
    const offset = append ? nextProjectOffset : 0;
    const [projectPage, departmentData, userData] = await Promise.all([
      apiGet<PaginatedResponse<Project>>(`/projects?paginate=true&limit=20&offset=${offset}`),
      apiGet<Department[]>("/departments"),
      apiGet<CRMUser[]>("/users"),
    ]);

    setProjects((current) => (append ? [...current, ...projectPage.items] : projectPage.items));
    setHasMoreProjects(projectPage.hasMore);
    setNextProjectOffset(projectPage.nextOffset);
    setDepartments(departmentData);
    setTeam(userData);

    if (!selectedProjectId && projectPage.items[0]) {
      setSelectedProjectId(projectPage.items[0].id);
    }
  };

  const loadProjectTasks = async (projectId: string) => {
    const taskData = await apiGet<Task[]>(`/tasks?projectId=${projectId}`);
    setTasks(taskData);
  };

  useEffect(() => {
    async function loadData() {
      try {
        await loadProjects(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load projects");
      } finally {
        setLoading(false);
      }
    }

    if (user) {
      void loadData();
    }
  }, [user]);

  useEffect(() => {
    if (!selectedProjectId) {
      setTasks([]);
      return;
    }

    void loadProjectTasks(selectedProjectId);
  }, [selectedProjectId]);

  useRealtimeRefresh(user, ["project:updated", "task:updated", "org:updated"], async () => {
    await loadProjects();
    if (selectedProjectId) {
      await loadProjectTasks(selectedProjectId);
    }
  });

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId) ?? null,
    [projects, selectedProjectId]
  );

  const departmentMembersForSelectedProject = useMemo(() => {
    if (!selectedProject) {
      return [];
    }
    return team.filter(
      (member) =>
        member.departmentId === selectedProject.departmentId && assignableRoles.includes(member.role)
    );
  }, [team, selectedProject, assignableRoles]);

  const taskAssigneePickerSource = useMemo(() => {
    if (!selectedProject) {
      return team;
    }
    const roster = selectedProject.members ?? [];
    if (!roster.length) {
      return team;
    }
    const allowed = new Set(roster.map((row) => row.user.id));
    return team.filter((member) => allowed.has(member.id));
  }, [selectedProject, team]);

  const projectAssignRoleOptions = useMemo(() => {
    const pool = taskAssigneePickerSource.filter((member) => assignableRoles.includes(member.role));
    return sortedUniqueRoles(pool);
  }, [taskAssigneePickerSource, assignableRoles]);

  const filteredProjectAssignees = useMemo(
    () =>
      filterMembersForPicker(taskAssigneePickerSource, {
        searchQuery: projectAssignQuery,
        roleFilter: projectAssignRole,
        restrictToRoles: assignableRoles,
      }),
    [taskAssigneePickerSource, projectAssignQuery, projectAssignRole, assignableRoles]
  );

  const projectTeamRoleOptions = useMemo(
    () => sortedUniqueRoles(departmentMembersForSelectedProject),
    [departmentMembersForSelectedProject]
  );

  const filteredProjectTeamRoster = useMemo(
    () =>
      filterMembersForPicker(departmentMembersForSelectedProject, {
        searchQuery: projectTeamQuery,
        roleFilter: projectTeamRole,
        restrictToRoles: assignableRoles,
      }),
    [departmentMembersForSelectedProject, projectTeamQuery, projectTeamRole, assignableRoles]
  );

  const rosterMemberIdsSignature = selectedProject?.members?.map((m) => m.user.id).join(",") ?? "";

  useEffect(() => {
    if (!selectedProject) {
      setProjectMemberDraftIds([]);
      return;
    }
    setProjectMemberDraftIds(selectedProject.members?.map((row) => row.user.id) ?? []);
  }, [selectedProject?.id, rosterMemberIdsSignature]);

  useEffect(() => {
    if (!selectedProject) {
      return;
    }
    const roster = selectedProject.members ?? [];
    if (!roster.length) {
      return;
    }
    const allowed = new Set(roster.map((row) => row.user.id));
    setTaskForm((current) => ({
      ...current,
      userIds: current.userIds.filter((id) => allowed.has(id)),
    }));
    setEditTaskForm((current) => ({
      ...current,
      userIds: current.userIds.filter((id) => allowed.has(id)),
    }));
  }, [selectedProject?.id, rosterMemberIdsSignature]);

  const groupedTasks = useMemo(
    () => ({
      TODO: tasks.filter((task) => task.status === "TODO"),
      IN_PROGRESS: tasks.filter((task) => task.status === "IN_PROGRESS"),
      DONE: tasks.filter((task) => task.status === "DONE"),
    }),
    [tasks]
  );

  const projectAnalytics = useMemo(() => {
    const totalProjects = projects.length;
    const avgProgress = totalProjects
      ? Math.round(projects.reduce((sum, project) => sum + project.progress, 0) / totalProjects)
      : 0;
    const totalTasks = projects.reduce((sum, project) => sum + project.taskCounts.total, 0);
    const completedTasks = projects.reduce((sum, project) => sum + project.taskCounts.done, 0);
    const completionRate = totalTasks ? Math.round((completedTasks / totalTasks) * 100) : 0;
    const delayedProjects = projects.filter((project) => project.progress < 40 && project.taskCounts.total >= 3).length;
    return { totalProjects, avgProgress, totalTasks, completionRate, delayedProjects };
  }, [projects]);

  const handleAssigneeToggle = (userId: string) => {
    setTaskForm((current) => ({
      ...current,
      userIds: current.userIds.includes(userId)
        ? current.userIds.filter((id) => id !== userId)
        : [...current.userIds, userId],
    }));
  };

  const createProject = async () => {
    try {
      setCreatingProject(true);
      setError("");
      setNotice("");
      const project = await apiPost<Project>("/projects", projectForm);
      setProjectForm({
        name: "",
        description: "",
        departmentId: "",
        ownerId: "",
      });
      setSelectedProjectId(project.id);
      setNotice("Project created successfully.");
      await loadProjects(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create project");
    } finally {
      setCreatingProject(false);
    }
  };

  const createTask = async () => {
    if (!selectedProjectId) {
      return;
    }

    try {
      setCreatingTask(true);
      setError("");
      setNotice("");
      await apiPost("/tasks", {
        title: taskForm.title,
        description: taskForm.description,
        userIds: taskForm.userIds,
        projectId: selectedProjectId,
        priority: taskForm.priority,
        checklistItems: taskForm.checklistText
          .split("\n")
          .map((item) => item.trim())
          .filter(Boolean),
      });
      setTaskForm({
        title: "",
        description: "",
        userIds: [],
        checklistText: "",
        priority: "MEDIUM",
      });
      setNotice("Task added to project.");
      await loadProjectTasks(selectedProjectId);
      await loadProjects(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create project task");
    } finally {
      setCreatingTask(false);
    }
  };

  const updateTaskStatus = async (taskId: string, status: Task["status"]) => {
    try {
      await apiPut(`/tasks/${taskId}`, { status });
      if (selectedProjectId) {
        await loadProjectTasks(selectedProjectId);
      }
      await loadProjects(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to move task");
    }
  };

  const updateTaskPriority = async (taskId: string, priority: TaskPriority) => {
    try {
      await apiPut(`/tasks/${taskId}`, { priority });
      if (selectedProjectId) {
        await loadProjectTasks(selectedProjectId);
      }
      await loadProjects(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update priority");
    }
  };

  const openTaskEditor = (task: Task) => {
    setEditingTaskId(task.id);
    setEditTaskForm({
      title: task.title,
      description: task.description ?? "",
      userIds: task.assignments.map((assignment) => assignment.userId),
      checklistText: task.checklistItems.map((item) => item.title).join("\n"),
      priority: task.priority ?? "MEDIUM",
    });
  };

  const toggleEditAssignee = (userId: string) => {
    setEditTaskForm((current) => ({
      ...current,
      userIds: current.userIds.includes(userId)
        ? current.userIds.filter((id) => id !== userId)
        : [...current.userIds, userId],
    }));
  };

  const saveTaskEdits = async () => {
    if (!editingTaskId) {
      return;
    }

    try {
      setError("");
      setNotice("");
      await apiPut(`/tasks/${editingTaskId}`, {
        title: editTaskForm.title,
        description: editTaskForm.description,
        userIds: editTaskForm.userIds,
        priority: editTaskForm.priority,
        checklistItems: editTaskForm.checklistText
          .split("\n")
          .map((item) => item.trim())
          .filter(Boolean),
      });
      setEditingTaskId("");
      setNotice("Task updated successfully.");
      if (selectedProjectId) {
        await loadProjectTasks(selectedProjectId);
      }
      await loadProjects();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update task");
    }
  };

  const deleteTask = async (taskId: string) => {
    if (!window.confirm("Delete this task permanently?")) {
      return;
    }

    try {
      setError("");
      setNotice("");
      await apiDelete(`/tasks/${taskId}`);
      if (editingTaskId === taskId) {
        setEditingTaskId("");
      }
      setNotice("Task deleted successfully.");
      if (selectedProjectId) {
        await loadProjectTasks(selectedProjectId);
      }
      await loadProjects();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete task");
    }
  };

  const toggleProjectMemberDraft = (userId: string) => {
    setProjectMemberDraftIds((current) =>
      current.includes(userId) ? current.filter((id) => id !== userId) : [...current, userId]
    );
  };

  const saveProjectMembers = async () => {
    if (!selectedProjectId) {
      return;
    }

    try {
      setSavingProjectMembers(true);
      setError("");
      setNotice("");
      await apiPut(`/projects/${selectedProjectId}/members`, { memberUserIds: projectMemberDraftIds });
      setNotice("Project team updated.");
      await loadProjects(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update project team");
    } finally {
      setSavingProjectMembers(false);
    }
  };

  const sessionGate = renderSessionGate({
    loading: sessionLoading,
    user,
    error: sessionError,
    retry: retrySession,
    loadingTitle: "Loading projects",
    loadingDescription: "Preparing the project workspace.",
  });
  if (sessionGate) {
    return sessionGate;
  }

  if (!user) {
    return null;
  }

  return (
    <CRMShell user={user}>
      <div className="space-y-4">
        <Surface>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--text-faint)]">Projects analytics</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[var(--text-main)]">Project command center</h1>
          <p className="mt-3 text-sm leading-6 text-[var(--text-soft)]">
            A simple analytical view of project throughput, completion quality, and potential delivery risk.
          </p>
          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            {[
              { label: "Total projects", value: projectAnalytics.totalProjects },
              { label: "Average progress", value: `${projectAnalytics.avgProgress}%` },
              { label: "Total tasks", value: projectAnalytics.totalTasks },
              { label: "Completion rate", value: `${projectAnalytics.completionRate}%` },
              { label: "Risk projects", value: projectAnalytics.delayedProjects },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-2xl border px-4 py-3"
                style={{ borderColor: "var(--border)", background: "var(--surface-soft)" }}
              >
                <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--text-faint)]">{item.label}</p>
                <p className="mt-2 text-xl font-semibold text-[var(--text-main)]">{item.value}</p>
              </div>
            ))}
          </div>
        </Surface>

        <div className="grid gap-4 xl:grid-cols-[300px_1fr]">
        <aside className="space-y-4">
          <Surface>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--text-faint)]">
              Department projects
            </p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-[var(--text-main)]">
              Project boards
            </h1>
            <p className="mt-3 text-sm leading-6 text-[var(--text-soft)]">
              Create department projects, then let managers break them into tasks and subtasks for employees and interns.
            </p>
          </Surface>

          <Surface>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--text-faint)]">
              All boards
            </p>
            <div className="mt-4 space-y-3">
              {projects.map((project) => {
                const selected = selectedProjectId === project.id;
                return (
                  <button
                    key={project.id}
                    type="button"
                    onClick={() => setSelectedProjectId(project.id)}
                    className="w-full rounded-2xl border px-4 py-4 text-left transition"
                    style={
                      selected
                        ? { borderColor: "#0f172a", background: "#0f172a", color: "#ffffff" }
                        : {
                            borderColor: "var(--border)",
                            background: "var(--surface-soft)",
                            color: "var(--text-main)",
                          }
                    }
                  >
                    <p className="font-semibold">{project.name}</p>
                    <p className={`mt-1 text-xs ${selected ? "text-slate-300" : "text-[var(--text-soft)]"}`}>
                      {project.department.name}
                    </p>
                    <div
                      className="mt-3 h-2 overflow-hidden rounded-full"
                      style={{ background: selected ? "rgba(255,255,255,0.2)" : "var(--surface)" }}
                    >
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-cyan-300"
                        style={{ width: `${project.progress}%` }}
                      />
                    </div>
                    <p className={`mt-2 text-xs ${selected ? "text-slate-300" : "text-[var(--text-soft)]"}`}>
                      Progress {project.progress}% - {project.taskCounts.done}/{project.taskCounts.total} tasks complete
                    </p>
                  </button>
                );
              })}
              {hasMoreProjects ? (
                <button
                  type="button"
                  disabled={loadingMoreProjects}
                  onClick={() => {
                    setLoadingMoreProjects(true);
                    void loadProjects(true).finally(() => setLoadingMoreProjects(false));
                  }}
                  className="w-full rounded-xl border px-3 py-2 text-sm font-semibold disabled:opacity-60"
                  style={{ borderColor: "var(--border)", color: "var(--text-main)" }}
                >
                  {loadingMoreProjects ? "Loading..." : "Load more projects"}
                </button>
              ) : null}
            </div>
          </Surface>

          <Surface>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--text-faint)]">
              Create project
            </p>
            <div className="mt-4 grid gap-3">
              <input
                className="h-11 rounded-2xl border px-3 text-sm outline-none"
                style={fieldStyle}
                placeholder="Project name"
                value={projectForm.name}
                onChange={(event) =>
                  setProjectForm((current) => ({ ...current, name: event.target.value }))
                }
              />
              <textarea
                className="min-h-24 rounded-2xl border px-3 py-3 text-sm outline-none"
                style={fieldStyle}
                placeholder="Project description"
                value={projectForm.description}
                onChange={(event) =>
                  setProjectForm((current) => ({ ...current, description: event.target.value }))
                }
              />
              <select
                className="h-11 rounded-2xl border px-3 text-sm outline-none"
                style={fieldStyle}
                value={projectForm.departmentId}
                onChange={(event) =>
                  setProjectForm((current) => ({ ...current, departmentId: event.target.value }))
                }
              >
                <option value="">Select department</option>
                {departments.map((department) => (
                  <option key={department.id} value={department.id}>
                    {department.name}
                  </option>
                ))}
              </select>
              <select
                className="h-11 rounded-2xl border px-3 text-sm outline-none"
                style={fieldStyle}
                value={projectForm.ownerId}
                onChange={(event) =>
                  setProjectForm((current) => ({ ...current, ownerId: event.target.value }))
                }
              >
                <option value="">Select owner</option>
                {team
                  .filter((member) => ["SUPERADMIN", "ADMIN", "MANAGER"].includes(member.role))
                  .map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.name} - {member.role}
                    </option>
                  ))}
              </select>
              <button
                type="button"
                disabled={creatingProject}
                onClick={() => void createProject()}
                className="rounded-2xl px-4 py-3 text-sm font-semibold text-white transition disabled:cursor-wait disabled:opacity-70"
                style={{ background: "var(--accent-strong)" }}
              >
                {creatingProject ? "Creating..." : "Create board"}
              </button>
            </div>
          </Surface>
        </aside>

        <section className="space-y-4">
          <Surface>
            {selectedProject ? (
              <>
                <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--text-faint)]">
                      {selectedProject.department.name}
                    </p>
                    <h2 className="mt-2 text-2xl font-semibold text-[var(--text-main)]">
                      {selectedProject.name}
                    </h2>
                    <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--text-soft)]">
                      {selectedProject.description || "No project description added yet."}
                    </p>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div
                      className="rounded-3xl border px-5 py-4"
                      style={{ borderColor: "var(--border)", background: "var(--surface-soft)" }}
                    >
                      <p className="text-xs uppercase tracking-[0.2em] text-[var(--text-faint)]">Owner</p>
                      <p className="mt-2 text-lg font-semibold text-[var(--text-main)]">
                        {selectedProject.owner?.name || "Unassigned"}
                      </p>
                    </div>
                    <div className="rounded-3xl bg-slate-950 px-5 py-4 text-white">
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Project progress</p>
                      <p className="mt-2 text-lg font-semibold">{selectedProject.progress}% complete</p>
                    </div>
                  </div>
                </div>

                <div className="mt-6 h-3 overflow-hidden rounded-full" style={{ background: "var(--surface-soft)" }}>
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-slate-950 via-blue-600 to-emerald-500"
                    style={{ width: `${selectedProject.progress}%` }}
                  />
                </div>
              </>
            ) : (
              <StatePanel title="No project selected" description="Create a board or select one from the left panel." />
            )}
          </Surface>

          {selectedProject ? (
            <Surface>
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--text-faint)]">
                    Project team
                  </p>
                  <h3 className="mt-2 text-xl font-semibold text-[var(--text-main)]">Task assignee pool</h3>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--text-soft)]">
                    Pick people from this project&apos;s department. After you save, new and edited tasks can only be
                    assigned to those team members. Leave nobody selected and save to use the full workspace list again.
                  </p>
                </div>
                <button
                  type="button"
                  disabled={savingProjectMembers}
                  onClick={() => void saveProjectMembers()}
                  className="h-11 shrink-0 rounded-2xl px-5 text-sm font-semibold text-white transition disabled:opacity-70"
                  style={{ background: "var(--accent-strong)" }}
                >
                  {savingProjectMembers ? "Saving..." : "Save project team"}
                </button>
              </div>
              <div className="mt-4">
                <MemberPickerToolbar
                  searchQuery={projectTeamQuery}
                  onSearchChange={setProjectTeamQuery}
                  roleFilter={projectTeamRole}
                  onRoleFilterChange={setProjectTeamRole}
                  roleOptions={projectTeamRoleOptions}
                />
              </div>
              <div className="mt-3 grid max-h-72 gap-3 overflow-auto sm:grid-cols-2">
                {filteredProjectTeamRoster.length === 0 ? (
                  <p
                    className="col-span-full rounded-2xl border px-4 py-6 text-sm text-[var(--text-soft)]"
                    style={{ borderColor: "var(--border)" }}
                  >
                    No people in this department match your filters.
                  </p>
                ) : (
                  filteredProjectTeamRoster.map((member) => (
                    <label
                      key={member.id}
                      className="flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm"
                      style={{
                        borderColor: "var(--border)",
                        background: "var(--surface-soft)",
                        color: "var(--text-main)",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={projectMemberDraftIds.includes(member.id)}
                        onChange={() => toggleProjectMemberDraft(member.id)}
                      />
                      <span>
                        {member.name} - {member.role}
                      </span>
                    </label>
                  ))
                )}
              </div>
              <p className="mt-3 text-xs text-[var(--text-faint)]">
                {(selectedProject.members ?? []).length > 0
                  ? `Task assignees use the last saved team (${(selectedProject.members ?? []).length} people), not draft checkboxes until you save.`
                  : "No saved team yet — task assignees below include everyone you can normally assign."}
              </p>
            </Surface>
          ) : null}

          {selectedProject ? (
            <Surface>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--text-faint)]">
                    Add task
                  </p>
                  <h3 className="mt-2 text-xl font-semibold text-[var(--text-main)]">Create project task</h3>
                </div>
              </div>

              <div className="mt-6 grid gap-4 xl:grid-cols-[1fr_1fr]">
                <div className="grid gap-4">
                  <input
                    className="h-12 rounded-2xl border px-4 outline-none"
                    style={fieldStyle}
                    placeholder="Task title"
                    value={taskForm.title}
                    onChange={(event) =>
                      setTaskForm((current) => ({ ...current, title: event.target.value }))
                    }
                  />
                  <textarea
                    className="min-h-28 rounded-2xl border px-4 py-3 outline-none"
                    style={fieldStyle}
                    placeholder="Task description"
                    value={taskForm.description}
                    onChange={(event) =>
                      setTaskForm((current) => ({ ...current, description: event.target.value }))
                    }
                  />
                  <label className="grid gap-2">
                    <span className="text-sm font-medium text-[var(--text-main)]">Priority</span>
                    <select
                      className="h-12 rounded-2xl border px-4 text-sm outline-none"
                      style={fieldStyle}
                      value={taskForm.priority}
                      onChange={(event) =>
                        setTaskForm((current) => ({
                          ...current,
                          priority: event.target.value as TaskPriority,
                        }))
                      }
                    >
                      {TASK_PRIORITY_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <textarea
                    className="min-h-28 rounded-2xl border px-4 py-3 outline-none"
                    style={fieldStyle}
                    placeholder={"Subtasks checklist, one per line\nExample:\nBuild UI\nConnect API\nQA and deploy"}
                    value={taskForm.checklistText}
                    onChange={(event) =>
                      setTaskForm((current) => ({ ...current, checklistText: event.target.value }))
                    }
                  />
                </div>

                <div>
                  <p className="text-sm font-medium text-[var(--text-main)]">
                    {(selectedProject.members ?? []).length > 0
                      ? "Assign to project team members (list filtered from your saved roster above)"
                      : user?.role === "SUPERADMIN"
                        ? "Assign to team (including admins and managers)"
                        : "Assign to employees or interns"}
                  </p>
                  <div className="mt-3">
                    <MemberPickerToolbar
                      searchQuery={projectAssignQuery}
                      onSearchChange={setProjectAssignQuery}
                      roleFilter={projectAssignRole}
                      onRoleFilterChange={setProjectAssignRole}
                      roleOptions={projectAssignRoleOptions}
                    />
                  </div>
                  <div className="mt-3 grid max-h-72 gap-3 overflow-auto sm:grid-cols-2">
                    {filteredProjectAssignees.length === 0 ? (
                      <p className="col-span-full rounded-2xl border px-4 py-6 text-sm text-[var(--text-soft)]" style={{ borderColor: "var(--border)" }}>
                        No matches. Adjust search or role filter.
                      </p>
                    ) : (
                      filteredProjectAssignees.map((member) => (
                        <label
                          key={member.id}
                          className="flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm"
                          style={{
                            borderColor: "var(--border)",
                            background: "var(--surface-soft)",
                            color: "var(--text-main)",
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={taskForm.userIds.includes(member.id)}
                            onChange={() => handleAssigneeToggle(member.id)}
                          />
                          <span>
                            {member.name} - {member.role}
                          </span>
                        </label>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {error ? <p className="mt-4 text-sm font-medium text-rose-600">{error}</p> : null}
              {notice ? <p className="mt-4 text-sm font-medium text-emerald-600">{notice}</p> : null}

              <button
                type="button"
                disabled={creatingTask}
                onClick={() => void createTask()}
                className="mt-6 rounded-2xl px-5 py-3 text-sm font-semibold text-white transition disabled:cursor-wait disabled:opacity-70"
                style={{ background: "var(--accent-strong)" }}
              >
                {creatingTask ? "Creating..." : "Add new task"}
              </button>
            </Surface>
          ) : null}

          <section className="grid gap-4 xl:grid-cols-3">
            {columns.map((column) => (
              <div
                key={column.key}
                className="rounded-[20px] border p-5"
                style={{
                  background: "var(--surface)",
                  borderColor: "var(--border)",
                  boxShadow: "var(--shadow-soft)",
                }}
              >
                <div className="flex items-center gap-3">
                  <span className={`h-3 w-3 rounded-full ${column.tone}`} />
                  <h3 className="text-sm font-semibold uppercase tracking-[0.22em] text-[var(--text-soft)]">
                    {column.label} ({groupedTasks[column.key].length})
                  </h3>
                </div>

                <div className="mt-5 space-y-4">
                  {groupTasksByAssignees(groupedTasks[column.key]).map((assigneeGroup) => (
                    <div
                      key={assigneeGroup.key}
                      className="rounded-[18px] border p-3"
                      style={{ borderColor: "var(--border)", background: "color-mix(in srgb, var(--surface-soft) 92%, var(--border))" }}
                    >
                      <p className="mb-3 border-b pb-2 text-xs font-semibold uppercase tracking-wide text-[var(--text-soft)]" style={{ borderColor: "var(--border)" }}>
                        {assigneeGroup.label}
                        <span className="ml-2 font-normal normal-case text-[var(--text-faint)]">
                          ({assigneeGroup.tasks.length} task{assigneeGroup.tasks.length === 1 ? "" : "s"})
                        </span>
                      </p>
                      <div className="space-y-3">
                        {assigneeGroup.tasks.map((task) => {
                          const completedChecklist = task.checklistItems.filter((item) => item.completed).length;
                          return (
                            <article
                              key={task.id}
                              className="overflow-hidden rounded-[14px] border p-4"
                              style={{ borderColor: "var(--border)", background: "var(--surface-soft)" }}
                            >
                              <div className="flex flex-col gap-3">
                                <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                  <div className="min-w-0 flex-1">
                                    <h4 className="text-lg font-semibold leading-snug text-[var(--text-main)] [overflow-wrap:anywhere]">
                                      {task.title}
                                    </h4>
                                  </div>
                                  <div className="flex w-full min-w-0 shrink-0 flex-wrap items-center gap-2 sm:w-auto sm:max-w-[min(100%,20rem)] sm:justify-end">
                                    <button
                                      type="button"
                                      onClick={() => openTaskEditor(task)}
                                      className="rounded-full border px-3 py-1 text-xs font-semibold"
                                      style={{ borderColor: "var(--border)", color: "var(--text-soft)" }}
                                    >
                                      Edit
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => void deleteTask(task.id)}
                                      className="rounded-full border px-3 py-1 text-xs font-semibold text-rose-600"
                                      style={{ borderColor: "var(--border)" }}
                                    >
                                      Delete
                                    </button>
                                    <select
                                      value={task.priority ?? "MEDIUM"}
                                      onChange={(event) =>
                                        void updateTaskPriority(task.id, event.target.value as TaskPriority)
                                      }
                                      className="min-w-0 flex-1 rounded-xl border px-2 py-1.5 text-[11px] font-semibold sm:flex-initial sm:min-w-[7.5rem]"
                                      style={{
                                        borderColor: "var(--border)",
                                        background: "var(--surface)",
                                        color: "var(--text-main)",
                                      }}
                                      title="Priority"
                                    >
                                      {TASK_PRIORITY_OPTIONS.map((opt) => (
                                        <option key={opt.value} value={opt.value}>
                                          {opt.label}
                                        </option>
                                      ))}
                                    </select>
                                    <select
                                      value={task.status}
                                      onChange={(event) =>
                                        void updateTaskStatus(task.id, event.target.value as Task["status"])
                                      }
                                      className="min-w-0 flex-1 rounded-xl border px-3 py-2 text-xs font-semibold sm:flex-initial sm:min-w-[9.5rem]"
                                      style={{
                                        borderColor: "var(--border)",
                                        background: "var(--surface)",
                                        color: "var(--text-main)",
                                      }}
                                      title="Status"
                                    >
                                      {columns.map((option) => (
                                        <option key={option.key} value={option.key}>
                                          {option.label}
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                </div>
                                <p className="text-sm leading-relaxed text-[var(--text-soft)] [overflow-wrap:anywhere]">
                                  {task.description || "No description"}
                                </p>
                              </div>

                        {editingTaskId === task.id ? (
                          <div
                            className="mt-4 grid gap-3 rounded-2xl border p-4"
                            style={{ borderColor: "var(--border)", background: "var(--surface)" }}
                          >
                            <input
                              className="h-11 rounded-2xl border px-3 text-sm outline-none"
                              style={fieldStyle}
                              value={editTaskForm.title}
                              onChange={(event) =>
                                setEditTaskForm((current) => ({ ...current, title: event.target.value }))
                              }
                            />
                            <textarea
                              className="min-h-24 rounded-2xl border px-3 py-3 text-sm outline-none"
                              style={fieldStyle}
                              value={editTaskForm.description}
                              onChange={(event) =>
                                setEditTaskForm((current) => ({ ...current, description: event.target.value }))
                              }
                            />
                            <label className="grid gap-1.5">
                              <span className="text-xs font-semibold text-[var(--text-soft)]">Priority</span>
                              <select
                                className="h-11 rounded-2xl border px-3 text-sm outline-none"
                                style={fieldStyle}
                                value={editTaskForm.priority}
                                onChange={(event) =>
                                  setEditTaskForm((current) => ({
                                    ...current,
                                    priority: event.target.value as TaskPriority,
                                  }))
                                }
                              >
                                {TASK_PRIORITY_OPTIONS.map((opt) => (
                                  <option key={opt.value} value={opt.value}>
                                    {opt.label}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <textarea
                              className="min-h-24 rounded-2xl border px-3 py-3 text-sm outline-none"
                              style={fieldStyle}
                              value={editTaskForm.checklistText}
                              onChange={(event) =>
                                setEditTaskForm((current) => ({ ...current, checklistText: event.target.value }))
                              }
                            />
                            <div className="grid gap-2">
                              <MemberPickerToolbar
                                searchQuery={projectAssignQuery}
                                onSearchChange={setProjectAssignQuery}
                                roleFilter={projectAssignRole}
                                onRoleFilterChange={setProjectAssignRole}
                                roleOptions={projectAssignRoleOptions}
                              />
                              <div className="grid gap-2 sm:grid-cols-2">
                                {filteredProjectAssignees.length === 0 ? (
                                  <p className="col-span-full rounded-2xl border px-3 py-4 text-sm text-[var(--text-soft)]" style={{ borderColor: "var(--border)" }}>
                                    No matches. Adjust filters above.
                                  </p>
                                ) : (
                                  filteredProjectAssignees.map((member) => (
                                    <label
                                      key={member.id}
                                      className="flex items-center gap-3 rounded-2xl border px-3 py-2 text-sm"
                                      style={{ borderColor: "var(--border)", background: "var(--surface-soft)", color: "var(--text-main)" }}
                                    >
                                      <input
                                        type="checkbox"
                                        checked={editTaskForm.userIds.includes(member.id)}
                                        onChange={() => toggleEditAssignee(member.id)}
                                      />
                                      <span>{member.name}</span>
                                    </label>
                                  ))
                                )}
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => void saveTaskEdits()}
                                className="rounded-2xl px-4 py-2 text-sm font-semibold text-white"
                                style={{ background: "var(--accent-strong)" }}
                              >
                                Save
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingTaskId("")}
                                className="rounded-2xl border px-4 py-2 text-sm font-semibold"
                                style={{ borderColor: "var(--border)", color: "var(--text-soft)" }}
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : null}

                        <div className="mt-4 h-2 overflow-hidden rounded-full" style={{ background: "var(--surface)" }}>
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-slate-950 via-blue-600 to-emerald-500"
                            style={{ width: `${task.progress}%` }}
                          />
                        </div>
                        <div className="mt-3 flex items-center justify-between text-xs text-[var(--text-soft)]">
                          <span>{task.progress}% complete</span>
                          <span>
                            {completedChecklist}/{task.checklistItems.length} subtasks
                          </span>
                        </div>

                        <div className="mt-4 flex flex-wrap gap-2">
                          {task.assignments.map((assignment) => (
                            <span
                              key={assignment.id}
                              className="rounded-full border px-3 py-1 text-xs font-medium"
                              style={{ borderColor: "var(--border)", background: "var(--surface)", color: "var(--text-soft)" }}
                            >
                              {assignment.user.name}
                            </span>
                          ))}
                        </div>
                            </article>
                          );
                        })}
                      </div>
                    </div>
                  ))}

                  {!groupedTasks[column.key].length ? (
                    <div
                      className="rounded-[18px] border border-dashed p-6 text-sm"
                      style={{ borderColor: "var(--border)", background: "var(--surface-soft)", color: "var(--text-soft)" }}
                    >
                      No tasks in this column yet.
                    </div>
                  ) : null}
                </div>
              </div>
            ))}
          </section>
        </section>
      </div>
      </div>
    </CRMShell>
  );
}
