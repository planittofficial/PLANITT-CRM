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
import { StatCard } from "@/components/ui/stat-card";
import { Sheet } from "@/components/ui/sheet";
import { FolderKanbanIcon, PlusIcon, UsersIcon } from "@/components/ui/icons";
import type { TaskPriority } from "@/types/crm";

const FIELD_STYLE = { borderColor: "var(--border)", background: "var(--surface-soft)", color: "var(--text-main)" } as const;

export default function ProjectsPage() {
  const { globalSearch, searchSubmitted } = useCrmSearch();
  const projectSearch = useDeferredValue(globalSearch.trim().toLowerCase());
  const {
    user, loading, error, sessionGate, projects, departments, team, selectedProjectId, setSelectedProjectId,
    hasMoreProjects, loadingMoreProjects, setLoadingMoreProjects, loadProjects, projectForm, setProjectForm,
    creatingProject, createProject, taskForm, setTaskForm, editTaskForm, setEditTaskForm, editingTaskId, setEditingTaskId,
    creatingTask, createTask, updateTaskStatus, updateTaskPriority, openTaskEditor, saveTaskEdits, deleteTask,
    projectAssignQuery, setProjectAssignQuery, projectAssignRole, setProjectAssignRole, projectAssignRoleOptions, filteredProjectAssignees,
    projectTeamQuery, setProjectTeamQuery, projectTeamRole, setProjectTeamRole, projectTeamRoleOptions, filteredProjectTeamRoster,
    projectMemberDraftIds, toggleProjectMemberDraft, savingProjectMembers, saveProjectMembers,
    groupedTasks, projectAnalytics, selectedProject,
  } = useProjectsData();

  const [createProjectOpen, setCreateProjectOpen] = useState(false);
  const [createTaskOpen, setCreateTaskOpen] = useState(false);
  const [manageTeamOpen, setManageTeamOpen] = useState(false);
  const [projectPasteText, setProjectPasteText] = useState("");
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

  const handleTaskPaste = () => {
    const lines = projectPasteText.split("\n").map((line) => line.trim());
    const titleLine = lines.find((line) => {
      const lower = line.toLowerCase();
      return lower.startsWith("title:") || lower.startsWith("project:");
    });
    const descriptionIndex = lines.findIndex((line) => {
      const lower = line.toLowerCase();
      return lower.startsWith("description:") || lower.startsWith("desc:");
    });

    const title = titleLine?.replace(/^(title|project)\s*:/i, "").trim() || "";
    const description = descriptionIndex >= 0 ? lines.slice(descriptionIndex + 1).join("\n").trim() : "";

    if (!title) {
      showToast("Could not detect project structure.", "error");
      return;
    }

    setProjectForm((current) => ({ ...current, name: title, description }));
    showToast("Project fields auto-filled.", "success");
  };

  const visibleProjects = useMemo(() => {
    if (!searchSubmitted || !projectSearch) return projects;
    return projects.filter((project) => {
      const inName = project.name.toLowerCase().includes(projectSearch);
      const inDesc = (project.description ?? "").toLowerCase().includes(projectSearch);
      const inDept = (project.department?.name ?? "").toLowerCase().includes(projectSearch);
      const inOwner = (project.owner?.name ?? "").toLowerCase().includes(projectSearch);
      return inName || inDesc || inDept || inOwner;
    });
  }, [projects, projectSearch, searchSubmitted]);

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
      <div className="space-y-5 pb-6">
        {/* Header Action Bar */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-[var(--text-main)] sm:text-2xl">
              Project Command Center
            </h1>
            <p className="text-xs text-[var(--text-soft)] mt-0.5">
              Manage department project boards, track delivery velocity, and resolve task blockers.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {selectedProject && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  leftIcon={<UsersIcon size={14} />}
                  onClick={() => setManageTeamOpen(true)}
                >
                  Project Team ({selectedProject.members?.length ?? 0})
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  leftIcon={<PlusIcon size={14} />}
                  onClick={() => setCreateTaskOpen(true)}
                >
                  Add Task
                </Button>
              </>
            )}
            <Button
              variant="primary"
              size="sm"
              leftIcon={<FolderKanbanIcon size={14} />}
              onClick={() => setCreateProjectOpen(true)}
            >
              New Board
            </Button>
          </div>
        </div>

        {/* 5 Project Metric Cards */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <StatCard label="Total Projects" value={projectAnalytics.totalProjects} />
          <StatCard label="Avg Progress" value={`${projectAnalytics.avgProgress}%`} />
          <StatCard label="Total Tasks" value={projectAnalytics.totalTasks} />
          <StatCard label="Completion" value={`${projectAnalytics.completionRate}%`} />
          <StatCard label="At Risk" value={projectAnalytics.delayedProjects} />
        </div>

        {/* 2-Column Layout: Project Boards (Left) & Kanban View (Right) */}
        <div className="grid gap-5 lg:grid-cols-[280px_1fr]">
          {/* Boards List (Teams Channel List Style) */}
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-strong,#ffffff)] p-3 shadow-xs h-fit space-y-2">
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-2 px-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-[var(--text-soft)]">
                Project Boards
              </span>
              <span className="text-xs text-[var(--text-faint)]">{visibleProjects.length}</span>
            </div>

            <div className="space-y-1.5 max-h-52 sm:max-h-64 lg:max-h-[calc(100vh-280px)] overflow-y-auto pr-1">
              {visibleProjects.map((project) => {
                const isSelected = selectedProjectId === project.id;
                return (
                  <button
                    key={project.id}
                    type="button"
                    onClick={() => setSelectedProjectId(project.id)}
                    className={`w-full rounded-lg p-2.5 text-left transition-all ${
                      isSelected
                        ? "bg-[var(--accent)]/10 text-[var(--accent)] border border-[var(--accent)]/30 font-medium"
                        : "hover:bg-[var(--surface-soft)] text-[var(--text-main)] border border-transparent"
                    }`}
                  >
                    <p className="font-semibold text-xs truncate">{project.name}</p>
                    <p className="text-[11px] text-[var(--text-soft)] truncate mt-0.5">{project.department.name}</p>
                    <div className="mt-2 flex items-center justify-between text-[10px] text-[var(--text-faint)]">
                      <span>{project.progress}%</span>
                      <span>{project.taskCounts.done}/{project.taskCounts.total} done</span>
                    </div>
                    <div className="mt-1 h-1.5 w-full rounded-full bg-[var(--surface-soft)] overflow-hidden">
                      <div className="h-full bg-[var(--accent)] rounded-full transition-all" style={{ width: `${project.progress}%` }} />
                    </div>
                  </button>
                );
              })}

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

          {/* Active Project Kanban & Credentials */}
          <div className="space-y-4 min-w-0">
            {selectedProject ? (
              <>
                {/* Project Overview Banner */}
                <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-strong,#ffffff)] p-4 shadow-xs">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--accent)]">
                          {selectedProject.department.name}
                        </span>
                        <span className="text-[var(--text-faint)]">•</span>
                        <span className="text-xs text-[var(--text-soft)]">
                          Owner: {selectedProject.owner?.name ?? "Unassigned"}
                        </span>
                      </div>
                      <h2 className="text-lg font-bold text-[var(--text-main)] mt-1">{selectedProject.name}</h2>
                      {selectedProject.description && (
                        <p className="text-xs text-[var(--text-soft)] mt-1 max-w-2xl">{selectedProject.description}</p>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <div className="text-right">
                        <p className="text-xs font-semibold text-[var(--text-main)]">{selectedProject.progress}% complete</p>
                        <p className="text-[11px] text-[var(--text-soft)]">
                          {selectedProject.taskCounts.done} of {selectedProject.taskCounts.total} tasks
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 h-2 w-full rounded-full bg-[var(--surface-soft)] overflow-hidden">
                    <div
                      className="h-full bg-[var(--accent)] rounded-full transition-all"
                      style={{ width: `${selectedProject.progress}%` }}
                    />
                  </div>
                </div>

                {/* Project Credentials Panel */}
                <ProjectCredentialsPanel projectId={selectedProject.id} />

                {/* Kanban Task Board */}
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
                />
              </>
            ) : (
              <StatePanel title="No board selected" description="Select a project from the left list or create a new board." />
            )}
          </div>
        </div>

        {/* ── CREATE PROJECT DRAWER SHEET ───────────────────────────────────── */}
        <Sheet
          open={createProjectOpen}
          onClose={() => setCreateProjectOpen(false)}
          title="Create Project Board"
          description="Create a department project and assign an owner to oversee task delivery."
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
