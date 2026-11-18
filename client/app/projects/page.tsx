"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { CRMShell } from "@/components/layout/crm-shell";
import { MemberPickerToolbar } from "@/components/shared/member-picker-toolbar";
import { ResponsiveSelect } from "@/components/shared/responsive-select";
import { StatePanel } from "@/components/shared/state-panel";
import { showToast } from "@/hooks/use-toast";
import { ProjectsSkeleton } from "@/components/shared/skeleton";
import { ProjectCredentialsPanel } from "@/components/credentials/project-credentials-panel";
import { TaskKanban } from "@/components/projects/task-kanban";
import { parseSmartTaskPaste } from "@/lib/smart-paste";
import { useProjectsData, TASK_PRIORITY_OPTIONS } from "@/hooks/use-projects-data";
import { useCrmSearch } from "@/components/providers/crm-search-provider";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import {
  FolderKanbanIcon,
  PlusIcon,
  UsersIcon,
  SearchIcon,
  CheckSquareIcon,
  KeyIcon,
} from "@/components/ui/icons";
import type { TaskPriority, Task } from "@/types/crm";

type ActiveTab = "board" | "list" | "credentials" | "team";

export default function ProjectsPage() {
  const { globalSearch, searchSubmitted } = useCrmSearch();
  const projectSearch = useDeferredValue(globalSearch.trim().toLowerCase());
  const {
    user, loading, error, sessionGate, projects, departments, team, selectedProjectId, setSelectedProjectId,
    hasMoreProjects, loadingMoreProjects, setLoadingMoreProjects, loadProjects, projectForm, setProjectForm,
    creatingProject, createProject, taskForm, setTaskForm, editTaskForm, setEditTaskForm, editingTaskId, setEditingTaskId,
    creatingTask, createTask, quickCreateTask, updateTaskStatus, updateTaskPriority, openTaskEditor, saveTaskEdits, deleteTask,
    projectAssignQuery, setProjectAssignQuery, projectAssignRole, setProjectAssignRole, projectAssignRoleOptions, filteredProjectAssignees,
    projectTeamQuery, setProjectTeamQuery, projectTeamRole, setProjectTeamRole, projectTeamRoleOptions, filteredProjectTeamRoster,
    projectMemberDraftIds, toggleProjectMemberDraft, savingProjectMembers, saveProjectMembers,
    groupedTasks, projectAnalytics, selectedProject,
  } = useProjectsData();

  const [activeTab, setActiveTab] = useState<ActiveTab>("board");
  const [createProjectOpen, setCreateProjectOpen] = useState(false);
  const [createTaskOpen, setCreateTaskOpen] = useState(false);
  const [manageTeamOpen, setManageTeamOpen] = useState(false);
  const [mobileProjectPickerOpen, setMobileProjectPickerOpen] = useState(false);
  const [localProjectFilter, setLocalProjectFilter] = useState("");
  const [listQuickTitle, setListQuickTitle] = useState("");
  const [isAddingListTask, setIsAddingListTask] = useState(false);
  const [projectSmartPasteText, setProjectSmartPasteText] = useState("");

  const departmentOptions = useMemo(
    () => [{ value: "", label: "Select department" }, ...departments.map((department) => ({ value: department.id, label: department.name }))],
    [departments]
  );
  const ownerOptions = useMemo(
    () => [{ value: "", label: "Select owner" }, ...team.filter((member) => ["SUPERADMIN", "ADMIN", "MANAGER"].includes(member.role)).map((member) => ({ value: member.id, label: `${member.name} - ${member.role}` }))],
    [team]
  );
  const priorityOptions = useMemo(
    () => TASK_PRIORITY_OPTIONS.map((option) => ({ value: option.value, label: option.label })),
    []
  );

  const handleProjectSmartPaste = () => {
    const parsed = parseSmartTaskPaste(projectSmartPasteText);
    if (!parsed.title.trim()) {
      showToast("Could not detect task structure.", "error");
      return;
    }

    setTaskForm((current) => ({
      ...current,
      title: parsed.title,
      description: parsed.description,
      priority: parsed.priority,
      checklistText: parsed.checklistItems.join("\n"),
    }));
    showToast("Task fields auto-filled.", "success");
  };

  const visibleProjects = useMemo(() => {
    const query = (localProjectFilter || (searchSubmitted ? projectSearch : "")).toLowerCase().trim();
    if (!query) return projects;
    return projects.filter((project) => {
      const inName = project.name.toLowerCase().includes(query);
      const inDesc = (project.description ?? "").toLowerCase().includes(query);
      const inDept = (project.department?.name ?? "").toLowerCase().includes(query);
      const inOwner = (project.owner?.name ?? "").toLowerCase().includes(query);
      return inName || inDesc || inDept || inOwner;
    });
  }, [projects, localProjectFilter, projectSearch, searchSubmitted]);

  const visibleGroupedTasks = useMemo(() => {
    if (!searchSubmitted || !projectSearch) return groupedTasks;
    const match = (task: (typeof groupedTasks)["TODO"][number]) => {
      const inTitle = task.title.toLowerCase().includes(projectSearch);
      const inDesc = (task.description ?? "").toLowerCase().includes(projectSearch);
      const inAssignee = task.assignments.some((a) => a.user.name.toLowerCase().includes(projectSearch));
      return inTitle || inDesc || inAssignee;
    };
    return {
      TODO: groupedTasks.TODO.filter(match),
      IN_PROGRESS: groupedTasks.IN_PROGRESS.filter(match),
      DONE: groupedTasks.DONE.filter(match),
    };
  }, [groupedTasks, projectSearch, searchSubmitted]);

  const allVisibleTasksList = useMemo(() => {
    return [
      ...visibleGroupedTasks.TODO,
      ...visibleGroupedTasks.IN_PROGRESS,
      ...visibleGroupedTasks.DONE,
    ];
  }, [visibleGroupedTasks]);

  useEffect(() => {
    if (!visibleProjects.length) return;
    if (visibleProjects.some((project) => project.id === selectedProjectId)) return;
    setSelectedProjectId(visibleProjects[0].id);
  }, [selectedProjectId, setSelectedProjectId, visibleProjects]);

  if (sessionGate) return sessionGate;
  if (!user) return null;

  if (loading) {
    return (
      <CRMShell user={user}>
        <ProjectsSkeleton />
      </CRMShell>
    );
  }

  return (
    <CRMShell user={user}>
      <div className="space-y-3.5 pb-6">
        {/* ── DESKTOP HEADER & ACTIONS (Hidden on mobile) ──────────────── */}
        <div className="hidden lg:block space-y-3.5">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-bold tracking-tight text-[var(--text-main)] sm:text-xl">
                Projects
              </h1>
              <p className="text-xs text-[var(--text-soft)]">
                Organize team boards, sprint tasks, and credentials.
              </p>
            </div>

            <div className="flex items-center gap-2">
              {selectedProject && (
                <>
                  <button
                    type="button"
                    onClick={() => setManageTeamOpen(true)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface-strong,#ffffff)] px-2.5 py-1.5 text-xs font-semibold text-[var(--text-main)] hover:bg-[var(--surface-soft)] transition-colors shadow-2xs"
                    title="Manage project members"
                  >
                    <UsersIcon size={14} className="text-[var(--text-soft)]" />
                    <span>Team ({selectedProject.members?.length ?? 0})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setCreateTaskOpen(true)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface-strong,#ffffff)] px-2.5 py-1.5 text-xs font-semibold text-[var(--text-main)] hover:bg-[var(--surface-soft)] transition-colors shadow-2xs"
                    title="Add new task"
                  >
                    <PlusIcon size={14} className="text-[var(--accent)]" />
                    <span>Add Task</span>
                  </button>
                </>
              )}
              <Button
                variant="primary"
                size="sm"
                leftIcon={<FolderKanbanIcon size={14} />}
                onClick={() => setCreateProjectOpen(true)}
                className="text-xs"
              >
                New Board
              </Button>
            </div>
          </div>

          {/* Metrics Pill Strip */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
            <div className="flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface-strong,#ffffff)] px-3 py-1.5 text-xs shadow-2xs shrink-0">
              <span className="font-semibold text-[var(--text-soft)]">Boards:</span>
              <span className="font-bold text-[var(--text-main)]">{projectAnalytics.totalProjects}</span>
            </div>
            <div className="flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface-strong,#ffffff)] px-3 py-1.5 text-xs shadow-2xs shrink-0">
              <span className="font-semibold text-[var(--text-soft)]">Tasks:</span>
              <span className="font-bold text-[var(--text-main)]">{projectAnalytics.totalTasks}</span>
            </div>
            <div className="flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface-strong,#ffffff)] px-3 py-1.5 text-xs shadow-2xs shrink-0">
              <span className="font-semibold text-[var(--text-soft)]">Completion:</span>
              <span className="font-bold text-emerald-600">{projectAnalytics.completionRate}%</span>
            </div>
            <div className="flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface-strong,#ffffff)] px-3 py-1.5 text-xs shadow-2xs shrink-0">
              <span className="font-semibold text-[var(--text-soft)]">Avg Progress:</span>
              <span className="font-bold text-[var(--accent)]">{projectAnalytics.avgProgress}%</span>
            </div>
            {projectAnalytics.delayedProjects > 0 && (
              <div className="flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-900/40 dark:bg-amber-950/30 px-3 py-1.5 text-xs shadow-2xs shrink-0 text-amber-700 dark:text-amber-300">
                <span className="font-semibold">At Risk:</span>
                <span className="font-bold">{projectAnalytics.delayedProjects}</span>
              </div>
            )}
          </div>
        </div>

        {/* ── MOBILE STREAMLINED APP BAR (<lg) ──────────────────────────────── */}
        <div className="flex lg:hidden flex-col gap-2.5 pb-0.5">
          {/* Row 1: Project Picker Button + Quick Add Actions */}
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setMobileProjectPickerOpen(true)}
              className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface-strong,#ffffff)] px-3 py-2 text-left shadow-xs transition-all hover:border-[var(--accent)] active:scale-[0.98] min-w-0 flex-1"
            >
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-[var(--accent)] text-white font-bold text-xs shrink-0 shadow-2xs">
                📁
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-extrabold text-[var(--text-main)] truncate">
                  {selectedProject ? selectedProject.name : "Select Board"}
                </p>
                {selectedProject && (
                  <p className="text-[10px] text-[var(--text-soft)] truncate">
                    {selectedProject.department.name} • {selectedProject.progress}% done
                  </p>
                )}
              </div>
              <span className="text-[10px] font-bold text-[var(--accent)] shrink-0 bg-[var(--surface-hover)] px-1.5 py-0.5 rounded-md">
                Switch ▾
              </span>
            </button>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => setCreateTaskOpen(true)}
                className="flex h-9 items-center gap-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-3 text-xs font-bold text-white shadow-xs active:scale-95 transition-transform"
              >
                <PlusIcon size={14} />
                <span>Task</span>
              </button>
              <button
                type="button"
                onClick={() => setCreateProjectOpen(true)}
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface-strong,#ffffff)] text-[var(--text-main)] shadow-xs active:scale-95 hover:bg-[var(--surface-soft)]"
                title="New Board"
              >
                <FolderKanbanIcon size={15} />
              </button>
            </div>
          </div>

          {/* Row 2: Segmented View Switcher (Board | List | Team) */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center rounded-xl bg-[var(--surface-soft)] p-1 border border-[var(--border)]">
              {(["board", "list", "team"] as ActiveTab[]).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={`px-3 py-1 text-xs font-bold rounded-lg transition-all capitalize ${
                    activeTab === tab
                      ? "bg-[var(--surface-strong,#ffffff)] text-[var(--accent)] shadow-2xs border border-[var(--border)]"
                      : "text-[var(--text-soft)] hover:text-[var(--text-main)]"
                  }`}
                >
                  {tab === "board" ? "📋 Board" : tab === "list" ? "☰ List" : "👥 Team"}
                </button>
              ))}
            </div>

            {selectedProject && (
              <div className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-xl bg-[var(--surface-strong,#ffffff)] border border-[var(--border)] shadow-2xs">
                <span className="text-[10px] font-semibold text-[var(--text-soft)]">Sprint:</span>
                <span className="text-xs font-extrabold text-[var(--accent)]">{selectedProject.progress}%</span>
              </div>
            )}
          </div>
        </div>

        {/* ── 2-COLUMN TEAMS WORKSPACE (Channels sidebar on left, Tabbed workspace on right) ── */}
        <div className="grid gap-4 lg:grid-cols-[260px_1fr] items-start">
          {/* DESKTOP BOARDS LIST (Teams Channel Style) */}
          <div className="hidden lg:flex flex-col rounded-xl border border-[var(--border)] bg-[var(--surface-strong,#ffffff)] p-3 shadow-xs space-y-2.5">
            {/* Search Input for Project Boards */}
            <div className="relative">
              <SearchIcon size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-soft)]" />
              <input
                type="text"
                value={localProjectFilter}
                onChange={(e) => setLocalProjectFilter(e.target.value)}
                placeholder="Find board..."
                className="h-8 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] pl-7 pr-2.5 text-xs text-[var(--text-main)] outline-none focus:border-[var(--accent)] transition-all placeholder:text-[var(--text-faint)]"
              />
            </div>

            <div className="flex items-center justify-between border-b border-[var(--border)] pb-1.5 px-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-soft)]">
                Project Boards
              </span>
              <span className="text-[10px] font-semibold text-[var(--text-faint)]">
                {visibleProjects.length}
              </span>
            </div>

            <div className="space-y-1 max-h-[calc(100vh-280px)] overflow-y-auto pr-0.5">
              {visibleProjects.map((project) => {
                const isSelected = selectedProjectId === project.id;
                return (
                  <button
                    key={project.id}
                    type="button"
                    onClick={() => setSelectedProjectId(project.id)}
                    className={`w-full rounded-lg p-2 text-left transition-all ${
                      isSelected
                        ? "bg-[var(--accent)]/10 text-[var(--accent)] border border-[var(--accent)]/30 font-medium"
                        : "hover:bg-[var(--surface-soft)] text-[var(--text-main)] border border-transparent"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <p className="font-bold text-xs truncate">{project.name}</p>
                      <span className="text-[10px] font-semibold text-[var(--text-soft)] shrink-0">
                        {project.progress}%
                      </span>
                    </div>
                    <p className="text-[10px] text-[var(--text-soft)] truncate mt-0.5">
                      {project.department.name}
                    </p>
                    <div className="mt-1.5 h-1 w-full rounded-full bg-[var(--border)] overflow-hidden">
                      <div
                        className="h-full bg-[var(--accent)] rounded-full transition-all"
                        style={{ width: `${project.progress}%` }}
                      />
                    </div>
                  </button>
                );
              })}

              {visibleProjects.length === 0 && (
                <p className="text-center text-xs text-[var(--text-soft)] py-4">No boards match.</p>
              )}

              {hasMoreProjects && (
                <Button
                  variant="ghost"
                  size="xs"
                  className="w-full mt-2"
                  loading={loadingMoreProjects}
                  onClick={() => {
                    setLoadingMoreProjects(true);
                    void loadProjects(true).finally(() => setLoadingMoreProjects(false));
                  }}
                >
                  Load More Boards
                </Button>
              )}
            </div>
          </div>

          {/* ACTIVE PROJECT AREA (Teams Tabs & Clean Views) */}
          <div className="space-y-3 min-w-0">
            {selectedProject ? (
              <>
                {/* Clean Project Header Bar (Desktop only, mobile has it in top bar) */}
                <div className="hidden lg:block rounded-xl border border-[var(--border)] bg-[var(--surface-strong,#ffffff)] p-3.5 shadow-xs">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 text-[11px] text-[var(--text-soft)]">
                        <span className="font-bold uppercase tracking-wider text-[var(--accent)]">
                          {selectedProject.department.name}
                        </span>
                        <span>•</span>
                        <span>Owner: {selectedProject.owner?.name ?? "Unassigned"}</span>
                      </div>
                      <h2 className="text-base font-bold text-[var(--text-main)] truncate mt-0.5">
                        {selectedProject.name}
                      </h2>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-left sm:text-right">
                        <span className="text-xs font-bold text-[var(--text-main)]">
                          {selectedProject.progress}% complete
                        </span>
                        <p className="text-[10px] text-[var(--text-soft)]">
                          {selectedProject.taskCounts.done}/{selectedProject.taskCounts.total} tasks
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-2.5 h-1.5 w-full rounded-full bg-[var(--surface-soft)] overflow-hidden border border-[var(--border)]/50">
                    <div
                      className="h-full bg-[var(--accent)] rounded-full transition-all"
                      style={{ width: `${selectedProject.progress}%` }}
                    />
                  </div>
                </div>

                {/* Teams Channel Tabs (Board / List / Credentials / Team) - Desktop only */}
                <div className="hidden lg:flex items-center gap-1 border-b border-[var(--border)] pb-0.5 overflow-x-auto no-scrollbar">
                  {[
                    { id: "board", label: "Board", icon: FolderKanbanIcon },
                    { id: "list", label: "List", icon: CheckSquareIcon },
                    { id: "credentials", label: "Credentials", icon: KeyIcon },
                    { id: "team", label: "Team", icon: UsersIcon },
                  ].map((tab) => {
                    const isActive = activeTab === tab.id;
                    const Icon = tab.icon;
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setActiveTab(tab.id as ActiveTab)}
                        className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold transition-all border-b-2 -mb-[2px] ${
                          isActive
                            ? "border-[var(--accent)] text-[var(--accent)] font-bold"
                            : "border-transparent text-[var(--text-soft)] hover:text-[var(--text-main)]"
                        }`}
                      >
                        <Icon size={14} />
                        <span>{tab.label}</span>
                      </button>
                    );
                  })}
                </div>

                {/* ── TAB 1: KANBAN BOARD ── */}
                {activeTab === "board" && (
                  <TaskKanban
                    groupedTasks={visibleGroupedTasks}
                    editingTaskId={editingTaskId}
                    editTaskForm={editTaskForm}
                    filteredAssignees={filteredProjectAssignees}
                    assignQuery={projectAssignQuery}
                    onAssignQueryChange={setProjectAssignQuery}
                    assignRole={projectAssignRole}
                    onAssignRoleChange={setProjectAssignRole}
                    assignRoleOptions={projectAssignRoleOptions}
                    onEditTaskFormChange={(field, value) => setEditTaskForm((c) => ({ ...c, [field]: value }))}
                    onOpenEditor={openTaskEditor}
                    onCancelEdit={() => setEditingTaskId("")}
                    onSaveEdit={() => void saveTaskEdits()}
                    onDelete={(id) => void deleteTask(id)}
                    onStatusChange={(id, status) => void updateTaskStatus(id, status)}
                    onPriorityChange={(id, priority) => void updateTaskPriority(id, priority)}
                    toggleEditAssignee={(id) =>
                      setEditTaskForm((c) => ({
                        ...c,
                        userIds: c.userIds.includes(id) ? c.userIds.filter((x) => x !== id) : [...c.userIds, id],
                      }))
                    }
                    onQuickCreate={quickCreateTask}
                  />
                )}

                {/* ── TAB 2: CLEAN LIST VIEW (Perfect for mobile!) ── */}
                {activeTab === "list" && (
                  <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-strong,#ffffff)] p-3 shadow-xs space-y-2">
                    <div className="flex items-center justify-between border-b border-[var(--border)] pb-2 px-1">
                      <span className="text-xs font-bold text-[var(--text-main)]">
                        Tasks ({allVisibleTasksList.length})
                      </span>
                      <button
                        type="button"
                        onClick={() => setCreateTaskOpen(true)}
                        className="text-xs font-semibold text-[var(--accent)] hover:underline"
                      >
                        + Add Task
                      </button>
                    </div>

                    {allVisibleTasksList.length === 0 ? (
                      <div className="p-8 text-center text-xs text-[var(--text-soft)]">
                        No tasks found in this project.
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        {allVisibleTasksList.map((task) => {
                          const isDone = task.status === "DONE";
                          return (
                            <div
                              key={task.id}
                              className="group flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] p-2.5 transition-colors hover:border-[var(--accent)]/40 hover:bg-[var(--surface-strong,#ffffff)]"
                            >
                              <div className="min-w-0 flex-1 flex items-center gap-2.5">
                                <button
                                  type="button"
                                  onClick={() => void updateTaskStatus(task.id, isDone ? "TODO" : "DONE")}
                                  className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-colors ${
                                    isDone
                                      ? "bg-emerald-600 border-emerald-600 text-white"
                                      : task.status === "IN_PROGRESS"
                                      ? "border-blue-500 bg-blue-50 dark:bg-blue-950/40 text-blue-600"
                                      : "border-[var(--border-strong)] hover:border-[var(--accent)]"
                                  }`}
                                  title={isDone ? "Mark pending" : "Mark completed"}
                                >
                                  {isDone && <span className="text-[10px] font-black leading-none">✓</span>}
                                  {task.status === "IN_PROGRESS" && <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />}
                                </button>

                                <div className="min-w-0 flex-1 cursor-pointer" onClick={() => openTaskEditor(task)}>
                                  <h4 className={`text-xs font-semibold truncate hover:text-[var(--accent)] ${isDone ? "line-through text-[var(--text-faint)]" : "text-[var(--text-main)]"}`}>
                                    {task.title}
                                  </h4>
                                  {task.description && (
                                    <p className="text-[11px] text-[var(--text-soft)] line-clamp-1 mt-0.5">
                                      {task.description}
                                    </p>
                                  )}
                                </div>
                              </div>

                              <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                                <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                                  task.priority === "URGENT"
                                    ? "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300"
                                    : task.priority === "HIGH"
                                    ? "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
                                    : "bg-[var(--surface-strong,#ffffff)] border border-[var(--border)] text-[var(--text-soft)]"
                                }`}>
                                  {task.priority ?? "MEDIUM"}
                                </span>

                                <select
                                  value={task.status}
                                  onChange={(e) => void updateTaskStatus(task.id, e.target.value as Task["status"])}
                                  className="h-7 rounded border border-[var(--border)] bg-[var(--surface-strong,#ffffff)] px-1.5 text-[10px] font-medium outline-none focus:border-[var(--accent)]"
                                >
                                  <option value="TODO">Pending</option>
                                  <option value="IN_PROGRESS">In Progress</option>
                                  <option value="DONE">Completed</option>
                                </select>
                                <button
                                  type="button"
                                  onClick={() => openTaskEditor(task)}
                                  className="h-7 rounded border border-[var(--border)] bg-[var(--surface-strong,#ffffff)] px-2 text-[10px] font-semibold text-[var(--text-soft)] hover:text-[var(--text-main)]"
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void deleteTask(task.id)}
                                  className="h-7 rounded border border-rose-200 dark:border-rose-900/40 bg-[var(--surface-strong,#ffffff)] px-1.5 text-[10px] text-rose-600 hover:bg-rose-50"
                                  title="Delete task"
                                >
                                  ✕
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Inline Quick Add Task in List View */}
                    <div className="pt-2 border-t border-[var(--border)]">
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={listQuickTitle}
                          disabled={isAddingListTask}
                          onChange={(e) => setListQuickTitle(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && listQuickTitle.trim()) {
                              e.preventDefault();
                              setIsAddingListTask(true);
                              void quickCreateTask(listQuickTitle.trim(), "TODO").finally(() => {
                                setListQuickTitle("");
                                setIsAddingListTask(false);
                              });
                            }
                          }}
                          placeholder="+ Add a task to this project... (Press Enter)"
                          className="h-8 w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-2.5 text-xs text-[var(--text-main)] outline-none focus:border-[var(--accent)]"
                        />
                        {listQuickTitle.trim() && (
                          <button
                            type="button"
                            disabled={isAddingListTask}
                            onClick={() => {
                              setIsAddingListTask(true);
                              void quickCreateTask(listQuickTitle.trim(), "TODO").finally(() => {
                                setListQuickTitle("");
                                setIsAddingListTask(false);
                              });
                            }}
                            className="h-8 px-3 rounded-md bg-[var(--accent)] text-white text-xs font-semibold shrink-0"
                          >
                            {isAddingListTask ? "..." : "Add"}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* ── TAB 3: CREDENTIALS (Moved to clean tab instead of polluting main page) ── */}
                {activeTab === "credentials" && (
                  <ProjectCredentialsPanel projectId={selectedProject.id} />
                )}

                {/* ── TAB 4: TEAM ROSTER ── */}
                {activeTab === "team" && (
                  <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-strong,#ffffff)] p-4 shadow-xs space-y-3">
                    <div className="flex items-center justify-between border-b border-[var(--border)] pb-2.5">
                      <div>
                        <h3 className="text-sm font-bold text-[var(--text-main)]">Project Team Members</h3>
                        <p className="text-xs text-[var(--text-soft)]">
                          People permitted to be assigned tasks on this board.
                        </p>
                      </div>
                      <Button variant="outline" size="xs" onClick={() => setManageTeamOpen(true)}>
                        Manage Roster
                      </Button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                      {(selectedProject.members ?? []).map((m) => (
                        <div
                          key={m.user.id}
                          className="flex items-center gap-2.5 rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] p-2.5"
                        >
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--accent)] text-white text-xs font-bold">
                            {m.user.name.charAt(0)}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-[var(--text-main)] truncate">{m.user.name}</p>
                            <p className="text-[10px] text-[var(--text-soft)] truncate">{m.user.role}</p>
                          </div>
                        </div>
                      ))}

                      {(!selectedProject.members || selectedProject.members.length === 0) && (
                        <p className="col-span-full py-6 text-center text-xs text-[var(--text-soft)]">
                          No specific team members selected yet.
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <StatePanel title="No board selected" description="Select a project from the left list or create a new board." />
            )}
          </div>
        </div>

        {/* ── MOBILE PROJECT PICKER SHEET ───────────────────────────────────── */}
        <Sheet
          open={mobileProjectPickerOpen}
          onClose={() => setMobileProjectPickerOpen(false)}
          title="Select Project Board"
          description="Switch to another department board or project."
          width="md"
        >
          <div className="space-y-3">
            <div className="relative">
              <SearchIcon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-soft)]" />
              <input
                type="text"
                value={localProjectFilter}
                onChange={(e) => setLocalProjectFilter(e.target.value)}
                placeholder="Search boards..."
                className="h-9 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] pl-8 pr-3 text-xs outline-none focus:border-[var(--accent)]"
              />
            </div>

            <div className="space-y-1.5 max-h-96 overflow-y-auto">
              {visibleProjects.map((project) => (
                <button
                  key={project.id}
                  type="button"
                  onClick={() => {
                    setSelectedProjectId(project.id);
                    setMobileProjectPickerOpen(false);
                  }}
                  className={`w-full rounded-xl p-3 text-left transition-all ${
                    selectedProjectId === project.id
                      ? "bg-[var(--accent)]/10 text-[var(--accent)] border border-[var(--accent)]/30 font-bold"
                      : "border border-[var(--border)] bg-[var(--surface-soft)] text-[var(--text-main)] hover:bg-[var(--surface-hover)]"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold truncate">{project.name}</p>
                    <span className="text-[11px] font-semibold text-[var(--text-soft)]">{project.progress}%</span>
                  </div>
                  <p className="text-[11px] text-[var(--text-soft)] mt-0.5">{project.department.name}</p>
                </button>
              ))}
            </div>

            <Button
              variant="outline"
              size="sm"
              className="w-full mt-2"
              leftIcon={<PlusIcon size={14} />}
              onClick={() => {
                setMobileProjectPickerOpen(false);
                setCreateProjectOpen(true);
              }}
            >
              Create New Board
            </Button>
          </div>
        </Sheet>

        {/* ── CREATE PROJECT DRAWER SHEET ───────────────────────────────────── */}
        <Sheet
          open={createProjectOpen}
          onClose={() => setCreateProjectOpen(false)}
          title="Create Project Board"
          description="Create a department project and assign an owner."
          width="md"
          footer={
            <div className="flex items-center justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setCreateProjectOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                loading={creatingProject}
                onClick={async () => {
                  await createProject();
                  setCreateProjectOpen(false);
                }}
              >
                Create Board
              </Button>
            </div>
          }
        >
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-soft)] mb-1">
                Project Name *
              </label>
              <input
                className="h-9 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] px-3 text-sm outline-none focus:border-[var(--accent)] focus:bg-[var(--surface-strong,#ffffff)] transition-all"
                placeholder="e.g. Mobile App Q3 Launch"
                value={projectForm.name}
                onChange={(e) => setProjectForm((c) => ({ ...c, name: e.target.value }))}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-soft)] mb-1">
                Description
              </label>
              <textarea
                rows={3}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] p-3 text-sm outline-none focus:border-[var(--accent)] focus:bg-[var(--surface-strong,#ffffff)] transition-all"
                placeholder="Project objectives, milestones..."
                value={projectForm.description}
                onChange={(e) => setProjectForm((c) => ({ ...c, description: e.target.value }))}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-soft)] mb-1">
                Department *
              </label>
              <ResponsiveSelect
                value={projectForm.departmentId}
                onChange={(v) => setProjectForm((c) => ({ ...c, departmentId: v }))}
                options={departmentOptions}
                ariaLabel="Select department"
                buttonClassName="h-9 rounded-lg text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-soft)] mb-1">
                Project Owner *
              </label>
              <ResponsiveSelect
                value={projectForm.ownerId}
                onChange={(v) => setProjectForm((c) => ({ ...c, ownerId: v }))}
                options={ownerOptions}
                ariaLabel="Select owner"
                buttonClassName="h-9 rounded-lg text-xs"
              />
            </div>
          </div>
        </Sheet>

        {/* ── ADD TASK DRAWER SHEET ─────────────────────────────────────────── */}
        <Sheet
          open={createTaskOpen}
          onClose={() => setCreateTaskOpen(false)}
          title={`Add Task to ${selectedProject?.name ?? "Board"}`}
          description="Create a task with priority, checklist, and assignees."
          width="lg"
          footer={
            <div className="flex items-center justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setCreateTaskOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                loading={creatingTask}
                onClick={async () => {
                  await createTask();
                  setCreateTaskOpen(false);
                }}
              >
                Add Task
              </Button>
            </div>
          }
        >
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-soft)] mb-1">
                Task Title *
              </label>
              <input
                className="h-9 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] px-3 text-sm outline-none focus:border-[var(--accent)] focus:bg-[var(--surface-strong,#ffffff)] transition-all"
                placeholder="e.g. Implement Webhook Handler"
                value={taskForm.title}
                onChange={(e) => setTaskForm((c) => ({ ...c, title: e.target.value }))}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-soft)] mb-1">
                Description
              </label>
              <textarea
                rows={3}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] p-3 text-sm outline-none focus:border-[var(--accent)] focus:bg-[var(--surface-strong,#ffffff)] transition-all"
                placeholder="Task details and deliverables..."
                value={taskForm.description}
                onChange={(e) => setTaskForm((c) => ({ ...c, description: e.target.value }))}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-soft)] mb-1">
                  Priority
                </label>
                <ResponsiveSelect
                  priorityColors
                  value={taskForm.priority}
                  onChange={(v) => setTaskForm((c) => ({ ...c, priority: v as TaskPriority }))}
                  options={priorityOptions}
                  ariaLabel="Select priority"
                  buttonClassName="h-9 rounded-lg text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-soft)] mb-1">
                  Deadline
                </label>
                <input
                  type="date"
                  className="h-9 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] px-3 text-xs outline-none focus:border-blue-500"
                  value={taskForm.deadlineAt}
                  onChange={(e) => setTaskForm((c) => ({ ...c, deadlineAt: e.target.value }))}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-soft)] mb-1">
                Checklist (one per line)
              </label>
              <textarea
                rows={3}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] p-3 text-xs outline-none focus:border-blue-500"
                placeholder="Design layout&#10;Connect API&#10;QA test"
                value={taskForm.checklistText}
                onChange={(e) => setTaskForm((c) => ({ ...c, checklistText: e.target.value }))}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-soft)] mb-1">
                Assignees
              </label>
              <div className="mb-2">
                <MemberPickerToolbar
                  searchQuery={projectAssignQuery}
                  onSearchChange={setProjectAssignQuery}
                  roleFilter={projectAssignRole}
                  onRoleFilterChange={setProjectAssignRole}
                  roleOptions={projectAssignRoleOptions}
                />
              </div>
              <div className="max-h-40 overflow-y-auto rounded-lg border border-[var(--border)] p-2 space-y-1">
                {filteredProjectAssignees.map((m) => (
                  <label key={m.id} className="flex cursor-pointer items-center gap-2 rounded-md p-1.5 text-xs hover:bg-[var(--surface-soft)]">
                    <input
                      type="checkbox"
                      checked={taskForm.userIds.includes(m.id)}
                      onChange={() =>
                        setTaskForm((c) => ({
                          ...c,
                          userIds: c.userIds.includes(m.id) ? c.userIds.filter((id) => id !== m.id) : [...c.userIds, m.id],
                        }))
                      }
                    />
                    <span className="font-medium text-[var(--text-main)] truncate">{m.name}</span>
                    <span className="text-[10px] text-[var(--text-soft)]">({m.role})</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </Sheet>

        {/* ── PROJECT TEAM DRAWER SHEET ─────────────────────────────────────── */}
        <Sheet
          open={manageTeamOpen}
          onClose={() => setManageTeamOpen(false)}
          title="Project Assignee Pool"
          description="Members selected here can be assigned to tasks on this project."
          width="md"
          footer={
            <div className="flex items-center justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setManageTeamOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                loading={savingProjectMembers}
                onClick={async () => {
                  await saveProjectMembers();
                  setManageTeamOpen(false);
                }}
              >
                Save Team
              </Button>
            </div>
          }
        >
          <div className="space-y-3">
            <MemberPickerToolbar
              searchQuery={projectTeamQuery}
              onSearchChange={setProjectTeamQuery}
              roleFilter={projectTeamRole}
              onRoleFilterChange={setProjectTeamRole}
              roleOptions={projectTeamRoleOptions}
            />
            <div className="max-h-80 overflow-y-auto rounded-lg border border-[var(--border)] p-2 space-y-1">
              {filteredProjectTeamRoster.map((m) => (
                <label key={m.id} className="flex cursor-pointer items-center gap-2 rounded-md p-2 text-xs hover:bg-[var(--surface-soft)]">
                  <input
                    type="checkbox"
                    checked={projectMemberDraftIds.includes(m.id)}
                    onChange={() => toggleProjectMemberDraft(m.id)}
                  />
                  <span className="font-semibold text-[var(--text-main)]">{m.name}</span>
                  <span className="text-[10px] text-[var(--text-soft)]">({m.role})</span>
                </label>
              ))}
            </div>
          </div>
        </Sheet>
      </div>
    </CRMShell>
  );
}
