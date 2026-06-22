"use client";

import { useDeferredValue, useEffect, useMemo } from "react";
import { CRMShell } from "@/components/layout/crm-shell";
import { MemberPickerToolbar } from "@/components/shared/member-picker-toolbar";
import { ResponsiveSelect } from "@/components/shared/responsive-select";
import { StatePanel } from "@/components/shared/state-panel";
import { useState } from "react";
import { showToast } from "@/hooks/use-toast";
import { ProjectsSkeleton } from "@/components/shared/skeleton";
import { TaskKanban } from "@/components/projects/task-kanban";
import { parseSmartTaskPaste } from "@/lib/smart-paste";
import { useProjectsData, TASK_PRIORITY_OPTIONS } from "@/hooks/use-projects-data";
import { useCrmSearch } from "@/components/providers/crm-search-provider";

const FIELD_STYLE = { borderColor: "var(--border)", background: "var(--surface-soft)", color: "var(--text-main)" } as const;

function Surface({ children }: { children: React.ReactNode }) {
  return <section className="rounded-[20px] border p-5" style={{ background: "var(--surface)", borderColor: "var(--border)", boxShadow: "var(--shadow-soft)" }}>{children}</section>;
}

export default function ProjectsPage() {
  const { globalSearch, searchSubmitted } = useCrmSearch();
  const projectSearch = useDeferredValue(globalSearch.trim().toLowerCase());
  const {
    user, loading, error, notice, sessionGate, projects, departments, team, selectedProjectId, setSelectedProjectId,
    hasMoreProjects, loadingMoreProjects, setLoadingMoreProjects, loadProjects, projectForm, setProjectForm,
    creatingProject, createProject, taskForm, setTaskForm, editTaskForm, setEditTaskForm, editingTaskId, setEditingTaskId,
    creatingTask, createTask, updateTaskStatus, updateTaskPriority, openTaskEditor, saveTaskEdits, deleteTask,
    projectAssignQuery, setProjectAssignQuery, projectAssignRole, setProjectAssignRole, projectAssignRoleOptions, filteredProjectAssignees,
    projectTeamQuery, setProjectTeamQuery, projectTeamRole, setProjectTeamRole, projectTeamRoleOptions, filteredProjectTeamRoster,
    projectMemberDraftIds, toggleProjectMemberDraft, savingProjectMembers, saveProjectMembers,
    groupedTasks, projectAnalytics, selectedProject,
  } = useProjectsData();
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

  const parsed =
    parseSmartTaskPaste(
      projectSmartPasteText
    );

  if (!parsed.title.trim()) {

    showToast(
      "Could not detect task structure.",
      "error"
    );

    return;

  }
  

  setTaskForm((current) => ({
    ...current,
    title: parsed.title,
    description: parsed.description,
    priority: parsed.priority,
    checklistText:
      parsed.checklistItems.join("\n"),
  }));

  showToast(
    "Task fields auto-filled.",
    "success"
  );

};
const handleTaskPaste = () => {

  const lines =
    projectPasteText
      .split("\n")
      .map((line) => line.trim());

  const titleLine =
  lines.find((line) => {
    const lower = line.toLowerCase();
    return (
      lower.startsWith("title:") ||
      lower.startsWith("project:")
    );
  });

  const descriptionIndex =
  lines.findIndex((line) => {
    const lower = line.toLowerCase();
    return (
      lower.startsWith("description:") ||
      lower.startsWith("desc:")
    );
  });

  const title =
  titleLine
    ?.replace(/^(title|project)\s*:/i, "")
    .trim() || "";

  const description =
    descriptionIndex >= 0
      ? lines
          .slice(descriptionIndex + 1)
          .join("\n")
          .trim()
      : "";

  if (!title) {

    showToast(
      "Could not detect project structure.",
      "error"
    );

    return;

  }

  setProjectForm((current) => ({
    ...current,
    name: title,
    description,
  }));

  showToast(
    "Project fields auto-filled.",
    "success"
  );

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
      <div className="min-w-0 space-y-4 overflow-x-hidden pb-4">
        <Surface>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--text-faint)]">Projects analytics</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[var(--text-main)]">Project command center</h1>
          <p className="mt-3 text-sm leading-6 text-[var(--text-soft)]">A simple analytical view of project throughput, completion quality, and potential delivery risk.</p>
          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {[{ label: "Total projects", value: projectAnalytics.totalProjects }, { label: "Average progress", value: `${projectAnalytics.avgProgress}%` }, { label: "Total tasks", value: projectAnalytics.totalTasks }, { label: "Completion rate", value: `${projectAnalytics.completionRate}%` }, { label: "Risk projects", value: projectAnalytics.delayedProjects }].map((item) => (
              <div key={item.label} className="rounded-2xl border px-4 py-3" style={{ borderColor: "var(--border)", background: "var(--surface-soft)" }}>
                <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--text-faint)]">{item.label}</p>
                <p className="mt-2 text-xl font-semibold text-[var(--text-main)]">{item.value}</p>
              </div>
            ))}
          </div>
        </Surface>

        <div className="grid gap-4 xl:grid-cols-[300px_1fr]">
          <aside className="space-y-4">
            <Surface>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--text-faint)]">Department projects</p>
              <h1 className="mt-2 text-2xl font-semibold tracking-tight text-[var(--text-main)]">Project boards</h1>
              <p className="mt-3 text-sm leading-6 text-[var(--text-soft)]">Create department projects, then let managers break them into tasks and subtasks.</p>
            </Surface>
            <Surface>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--text-faint)]">All boards</p>
              <div className="mt-4 space-y-3">
                {visibleProjects.map((project) => {
                  const sel = selectedProjectId === project.id;
                  return (
                    <button key={project.id} type="button" onClick={() => setSelectedProjectId(project.id)} className="w-full rounded-2xl border px-4 py-4 text-left transition" style={sel ? { borderColor: "#0f172a", background: "#0f172a", color: "#ffffff" } : { borderColor: "var(--border)", background: "var(--surface-soft)", color: "var(--text-main)" }}>
                      <p className="font-semibold">{project.name}</p>
                      <p className={`mt-1 text-xs ${sel ? "text-slate-300" : "text-[var(--text-soft)]"}`}>{project.department.name}</p>
                      <div className="mt-3 h-2 overflow-hidden rounded-full" style={{ background: sel ? "rgba(255,255,255,0.2)" : "var(--surface)" }}>
                        <div className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-cyan-300" style={{ width: `${project.progress}%` }} />
                      </div>
                      <p className={`mt-2 text-xs ${sel ? "text-slate-300" : "text-[var(--text-soft)]"}`}>Progress {project.progress}% - {project.taskCounts.done}/{project.taskCounts.total} tasks complete</p>
                    </button>
                  );
                })}
                {hasMoreProjects ? (
                  <button type="button" disabled={loadingMoreProjects} onClick={() => { setLoadingMoreProjects(true); void loadProjects(true).finally(() => setLoadingMoreProjects(false)); }} className="w-full rounded-xl border px-3 py-2 text-sm font-semibold disabled:opacity-60" style={{ borderColor: "var(--border)", color: "var(--text-main)" }}>
                    {loadingMoreProjects ? "Loading..." : "Load more projects"}
                  </button>
                ) : null}
              </div>
            </Surface>
            <Surface>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--text-faint)]">Create project</p>
              <textarea
  readOnly
  onClick={(e) => {
  navigator.clipboard.writeText(
    (e.target as HTMLTextAreaElement).value
  );
   showToast(
    "Template copied to clipboard",
    "success"
   );
}}
  className="min-h-28 w-full rounded-2xl border px-3 py-3 text-sm"
  style={FIELD_STYLE}
  value={`Title: CRM Dashboard

Description:
Internal analytics dashboard`}
/>

<textarea
  className="min-h-28 w-full rounded-2xl border px-3 py-3 text-sm outline-none mt-3"
  style={FIELD_STYLE}
  placeholder="Paste project details here..."
  value={projectPasteText}
  onChange={(e) =>
    setProjectPasteText(e.target.value)
  }
/>

<button
  type="button"
  onClick={handleTaskPaste}
  className="rounded-2xl px-4 py-2 text-sm font-semibold text-white"
  style={{
    background: "var(--accent-strong)",
  }}
>
  Auto-fill project
</button>
              <div className="mt-4 grid gap-3">
                <div className="mt-4 grid gap-3">

  <textarea
    className="min-h-28 w-full min-w-0 box-border rounded-2xl border px-3 py-3 text-sm outline-none"
    style={FIELD_STYLE}
    placeholder={`Title: CRM Dashboard

Description:
Internal analytics dashboard`}
  />
</div>
                <input className="h-11 w-full min-w-0 box-border rounded-2xl border px-3 text-sm outline-none" style={FIELD_STYLE} placeholder="Project name" value={projectForm.name} onChange={(e) => setProjectForm((c) => ({ ...c, name: e.target.value }))} />
                <textarea className="min-h-24 w-full min-w-0 box-border rounded-2xl border px-3 py-3 text-sm outline-none" style={FIELD_STYLE} placeholder="Project description" value={projectForm.description} onChange={(e) => setProjectForm((c) => ({ ...c, description: e.target.value }))} />
                <ResponsiveSelect value={projectForm.departmentId} onChange={(value) => setProjectForm((c) => ({ ...c, departmentId: value }))} options={departmentOptions} ariaLabel="Select project department" buttonClassName="h-11 box-border px-3" />
                <ResponsiveSelect value={projectForm.ownerId} onChange={(value) => setProjectForm((c) => ({ ...c, ownerId: value }))} options={ownerOptions} ariaLabel="Select project owner" buttonClassName="h-11 box-border px-3" />
                <button type="button" disabled={creatingProject} onClick={() => void createProject()} className="w-full min-w-0 box-border rounded-2xl px-4 py-3 text-sm font-semibold text-white transition disabled:cursor-wait disabled:opacity-70" style={{ background: "var(--accent-strong)" }}>{creatingProject ? "Creating..." : "Create board"}</button>
              </div>
            </Surface>
          </aside>

          <section className="space-y-4">
            <Surface>
              {selectedProject ? (
                <>
                  <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--text-faint)]">{selectedProject.department.name}</p>
                      <h2 className="mt-2 text-2xl font-semibold text-[var(--text-main)]">{selectedProject.name}</h2>
                      <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--text-soft)]">{selectedProject.description || "No project description added yet."}</p>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="rounded-3xl border px-5 py-4" style={{ borderColor: "var(--border)", background: "var(--surface-soft)" }}><p className="text-xs uppercase tracking-[0.2em] text-[var(--text-faint)]">Owner</p><p className="mt-2 text-lg font-semibold text-[var(--text-main)]">{selectedProject.owner?.name || "Unassigned"}</p></div>
                      <div className="rounded-3xl bg-slate-950 px-5 py-4 text-white"><p className="text-xs uppercase tracking-[0.2em] text-slate-400">Project progress</p><p className="mt-2 text-lg font-semibold">{selectedProject.progress}% complete</p></div>
                    </div>
                  </div>
                  <div className="mt-6 h-3 overflow-hidden rounded-full" style={{ background: "var(--surface-soft)" }}>
                    <div className="h-full rounded-full bg-gradient-to-r from-slate-950 via-blue-600 to-emerald-500" style={{ width: `${selectedProject.progress}%` }} />
                  </div>
                </>
              ) : <StatePanel title="No project selected" description="Create a board or select one from the left panel." />}
            </Surface>

            {selectedProject ? (
              <Surface>
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div><p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--text-faint)]">Project team</p><h3 className="mt-2 text-xl font-semibold text-[var(--text-main)]">Task assignee pool</h3><p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--text-soft)]">Pick people from this project&apos;s department. After saving, new tasks can only be assigned to those members.</p></div>
                  <button type="button" disabled={savingProjectMembers} onClick={() => void saveProjectMembers()} className="h-11 shrink-0 rounded-2xl px-5 text-sm font-semibold text-white transition disabled:opacity-70" style={{ background: "var(--accent-strong)" }}>{savingProjectMembers ? "Saving..." : "Save project team"}</button>
                </div>
                <div className="mt-4"><MemberPickerToolbar searchQuery={projectTeamQuery} onSearchChange={setProjectTeamQuery} roleFilter={projectTeamRole} onRoleFilterChange={setProjectTeamRole} roleOptions={projectTeamRoleOptions} /></div>
                <div className="mt-3 grid max-h-72 gap-3 overflow-auto sm:grid-cols-2">
                  {filteredProjectTeamRoster.length === 0 ? <p className="col-span-full rounded-2xl border px-4 py-6 text-sm text-[var(--text-soft)]" style={{ borderColor: "var(--border)" }}>No people in this department match your filters.</p>
                    : filteredProjectTeamRoster.map((m) => (
                      <label key={m.id} className="flex min-w-0 items-center gap-3 rounded-2xl border px-4 py-3 text-sm" style={{ borderColor: "var(--border)", background: "var(--surface-soft)", color: "var(--text-main)" }}>
                        <input type="checkbox" checked={projectMemberDraftIds.includes(m.id)} onChange={() => toggleProjectMemberDraft(m.id)} />
                        <span className="min-w-0 truncate">{m.name} - {m.role}</span>
                      </label>
                    ))}
                </div>
                <p className="mt-3 text-xs text-[var(--text-faint)]">{(selectedProject.members ?? []).length > 0 ? `Task assignees use the last saved team (${(selectedProject.members ?? []).length} people), not draft checkboxes until you save.` : "No saved team yet — task assignees include everyone you can normally assign."}</p>
              </Surface>
            ) : null}

            {selectedProject ? (
              <Surface>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--text-faint)]">Add task</p>
                <h3 className="mt-2 text-xl font-semibold text-[var(--text-main)]">Create project task</h3>
                <div className="mt-4 grid gap-3">
                  <textarea
  readOnly
  onClick={(e) => {
  navigator.clipboard.writeText(
    (e.target as HTMLTextAreaElement).value
  );
   showToast(
    "Template copied to clipboard",
    "success"
   );
}}
  className="min-h-36 w-full rounded-2xl border px-3 py-3 text-sm"
  style={FIELD_STYLE}
  value={`Title: Dashboard Fix

Description:
Review dashboard loading

Priority: HIGH

Checklist:
- Fix UI
- Fix backend`}
/>
  <textarea
    className="min-h-32 rounded-2xl border px-4 py-3 outline-none"
    style={FIELD_STYLE}
    placeholder={`Title: Dashboard Fix

Description:
Review dashboard loading

Priority: HIGH

Checklist:
- Fix UI
- Fix backend`}
    value={projectSmartPasteText}
    onChange={(e) =>
      setProjectSmartPasteText(
        e.target.value
      )
    }
  />

  <button
    type="button"
    onClick={handleProjectSmartPaste}
    className="rounded-2xl border px-4 py-2 text-sm font-medium"
    style={{
  background: "#2563eb",
  color: "#ffffff",
}}
  >
    Auto-fill from paste
  </button>
</div>
                <div className="mt-6 grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                  <div className="grid min-w-0 gap-4">
                    <input className="h-12 rounded-2xl border px-4 outline-none" style={FIELD_STYLE} placeholder="Task title" value={taskForm.title} onChange={(e) => setTaskForm((c) => ({ ...c, title: e.target.value }))} />
                    <textarea className="min-h-28 rounded-2xl border px-4 py-3 outline-none" style={FIELD_STYLE} placeholder="Task description" value={taskForm.description} onChange={(e) => setTaskForm((c) => ({ ...c, description: e.target.value }))} />
                    <label className="grid gap-2"><span className="text-sm font-medium text-[var(--text-main)]">Priority</span>
                      <ResponsiveSelect priorityColors value={taskForm.priority} onChange={(value) => setTaskForm((c) => ({ ...c, priority: value as typeof c.priority }))} options={priorityOptions} ariaLabel="Select project task priority" buttonClassName="h-12 px-4" />
                    </label>
                    <label className="grid gap-2"><span className="text-sm font-medium text-[var(--text-main)]">Deadline</span>
                      <input
  type="date" className="h-12 w-full min-w-0 rounded-2xl border px-4 text-sm outline-none" style={FIELD_STYLE} value={taskForm.deadlineAt} onChange={(e) => setTaskForm((c) => ({ ...c, deadlineAt: e.target.value }))} />
                    </label>
                    <textarea className="min-h-28 rounded-2xl border px-4 py-3 outline-none" style={FIELD_STYLE} placeholder={"Subtasks checklist, one per line\nExample:\nBuild UI\nConnect API\nQA and deploy"} value={taskForm.checklistText} onChange={(e) => setTaskForm((c) => ({ ...c, checklistText: e.target.value }))} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[var(--text-main)]">{(selectedProject.members ?? []).length > 0 ? "Assign to project team members" : "Assign to team members"}</p>
                    <div className="mt-3"><MemberPickerToolbar searchQuery={projectAssignQuery} onSearchChange={setProjectAssignQuery} roleFilter={projectAssignRole} onRoleFilterChange={setProjectAssignRole} roleOptions={projectAssignRoleOptions} /></div>
                    <div className="mt-3 grid max-h-72 gap-3 overflow-auto sm:grid-cols-2">
                      {filteredProjectAssignees.length === 0 ? <p className="col-span-full rounded-2xl border px-4 py-6 text-sm text-[var(--text-soft)]" style={{ borderColor: "var(--border)" }}>No matches. Adjust search or role filter.</p>
                        : filteredProjectAssignees.map((m) => (
                          <label key={m.id} className="flex min-w-0 items-center gap-3 rounded-2xl border px-4 py-3 text-sm" style={{ borderColor: "var(--border)", background: "var(--surface-soft)", color: "var(--text-main)" }}>
                            <input type="checkbox" checked={taskForm.userIds.includes(m.id)} onChange={() => setTaskForm((c) => ({ ...c, userIds: c.userIds.includes(m.id) ? c.userIds.filter((id) => id !== m.id) : [...c.userIds, m.id] }))} />
                            <span className="min-w-0 truncate">{m.name} - {m.role}</span>
                          </label>
                        ))}
                    </div>
                  </div>
                </div>
                {error ? <p className="mt-4 text-sm font-medium text-rose-600">{error}</p> : null}
                {notice ? <p className="mt-4 text-sm font-medium text-emerald-600">{notice}</p> : null}
                <button type="button" disabled={creatingTask} onClick={() => void createTask()} className="mt-6 rounded-2xl px-5 py-3 text-sm font-semibold text-white transition disabled:cursor-wait disabled:opacity-70" style={{ background: "var(--accent-strong)" }}>{creatingTask ? "Creating..." : "Add new task"}</button>
              
              </Surface>
            ) : null}

            <TaskKanban
              groupedTasks={visibleGroupedTasks}
              editingTaskId={editingTaskId} editTaskForm={editTaskForm}
              filteredAssignees={filteredProjectAssignees}
              assignQuery={projectAssignQuery} onAssignQueryChange={setProjectAssignQuery}
              assignRole={projectAssignRole} onAssignRoleChange={setProjectAssignRole}
              assignRoleOptions={projectAssignRoleOptions}
              onEditTaskFormChange={(field, value) => setEditTaskForm((c) => ({ ...c, [field]: value }))}
              onOpenEditor={openTaskEditor} onCancelEdit={() => setEditingTaskId("")}
              onSaveEdit={() => void saveTaskEdits()} onDelete={(id) => void deleteTask(id)}
              onStatusChange={(id, status) => void updateTaskStatus(id, status)}
              onPriorityChange={(id, priority) => void updateTaskPriority(id, priority)}
              toggleEditAssignee={(id) => setEditTaskForm((c) => ({ ...c, userIds: c.userIds.includes(id) ? c.userIds.filter((x) => x !== id) : [...c.userIds, id] }))}
            />
          </section>
        </div>
      </div>
    </CRMShell>
  );
}
