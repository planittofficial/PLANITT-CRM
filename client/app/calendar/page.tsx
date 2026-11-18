"use client";

import { useEffect, useState, useMemo } from "react";
import { CRMShell } from "@/components/layout/crm-shell";
import { useSession } from "@/hooks/use-session";
import { renderSessionGate } from "@/components/shared/session-gate";
import { apiGet, apiPost, apiDelete } from "@/lib/api";
import { showToast } from "@/hooks/use-toast";
import {
  CalendarDaysIcon,
  VideoIcon,
  PlusIcon,
  ClockIcon,
  UsersIcon,
  FolderKanbanIcon,
  SearchIcon,
  SparklesIcon,
} from "@/components/ui/icons";
import type { CalendarItem, CRMUser, Project } from "@/types/crm";

export default function CalendarPage() {
  const { user, loading: sessionLoading, error: sessionError, retry: retrySession } = useSession();
  const [items, setItems] = useState<CalendarItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [quickMeetLoading, setQuickMeetLoading] = useState(false);
  const [schedulingLoading, setSchedulingLoading] = useState(false);
  const [filterType, setFilterType] = useState<"ALL" | "MEETING" | "TASK_DEADLINE" | "LEAVE">("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [allUsers, setAllUsers] = useState<CRMUser[]>([]);
  const [allProjects, setAllProjects] = useState<Project[]>([]);

  // Form State
  const [eventTitle, setEventTitle] = useState("");
  const [eventDesc, setEventDesc] = useState("");
  const [eventDate, setEventDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [eventTime, setEventTime] = useState("10:00");
  const [eventDuration, setEventDuration] = useState("30");
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [selectedAttendeeIds, setSelectedAttendeeIds] = useState<string[]>([]);

  const fetchCalendar = async () => {
    try {
      setLoading(true);
      const res = await apiGet<{ events: CalendarItem[] }>("/calendar/events");
      setItems(res.events || []);
    } catch (err) {
      showToast("Failed to load calendar events", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchCalendar();
      apiGet<CRMUser[]>("/users").then(setAllUsers).catch(() => {});
      apiGet<Project[]>("/projects").then(setAllProjects).catch(() => {});
    }
  }, [user]);

  const handleQuickMeet = async () => {
    try {
      setQuickMeetLoading(true);
      const res = await apiPost<CalendarItem>("/calendar/quick-meet", {
        title: `${user?.name || "Team"} Instant Google Meet`,
      });
      if (res.meetUrl) {
        window.open(res.meetUrl, "_blank");
        await navigator.clipboard.writeText(res.meetUrl).catch(() => {});
        showToast("Google Meet launched & link copied to clipboard!", "success");
        fetchCalendar();
      }
    } catch (err) {
      showToast("Failed to start instant Google Meet", "error");
    } finally {
      setQuickMeetLoading(false);
    }
  };

  const handleScheduleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventTitle.trim()) {
      showToast("Meeting title is required", "error");
      return;
    }

    try {
      setSchedulingLoading(true);
      const startAt = new Date(`${eventDate}T${eventTime}:00`);
      const endAt = new Date(startAt.getTime() + Number(eventDuration) * 60000);

      const res = await apiPost<CalendarItem>("/calendar/events", {
        title: eventTitle.trim(),
        description: eventDesc.trim() || null,
        startAt: startAt.toISOString(),
        endAt: endAt.toISOString(),
        projectId: selectedProjectId || null,
        attendeeIds: selectedAttendeeIds,
      });

      showToast("Meeting scheduled with Google Meet link!", "success");
      setScheduleModalOpen(false);
      setEventTitle("");
      setEventDesc("");
      setSelectedAttendeeIds([]);
      fetchCalendar();
    } catch (err) {
      showToast("Failed to schedule meeting", "error");
    } finally {
      setSchedulingLoading(false);
    }
  };

  const handleDeleteEvent = async (id: string) => {
    if (!confirm("Are you sure you want to cancel this meeting?")) return;
    try {
      await apiDelete(`/calendar/events/${id}`);
      showToast("Meeting cancelled", "success");
      setItems((prev) => prev.filter((i) => i.id !== id));
    } catch (err) {
      showToast("Failed to cancel meeting", "error");
    }
  };

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (filterType !== "ALL" && item.type !== filterType) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          item.title.toLowerCase().includes(q) ||
          item.description?.toLowerCase().includes(q) ||
          item.project?.name?.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [items, filterType, searchQuery]);

  if (sessionLoading || sessionError || !user) {
    return renderSessionGate({ loading: sessionLoading, user, error: sessionError, retry: retrySession });
  }

  return (
    <CRMShell user={user}>
      <div className="flex h-full flex-col overflow-hidden bg-[var(--app-bg)]">
        {/* Top Action Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] bg-[var(--surface-strong,#ffffff)] px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-600 text-white shadow-xs">
              <CalendarDaysIcon size={20} />
            </div>
            <div>
              <h1 className="text-base font-bold text-[var(--text-main)]">Google Calendar & Meetings</h1>
              <p className="text-xs text-[var(--text-soft)]">
                Sync with Google Workspace, schedule Google Meet calls, and track deadlines
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleQuickMeet}
              disabled={quickMeetLoading}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 transition disabled:opacity-50"
            >
              <VideoIcon size={15} />
              <span>{quickMeetLoading ? "Launching..." : "Meet Now"}</span>
            </button>

            <button
              type="button"
              onClick={() => setScheduleModalOpen(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-[var(--accent)] px-3.5 py-2 text-xs font-bold text-white shadow-xs hover:opacity-90 transition"
            >
              <PlusIcon size={15} />
              <span>Schedule Meeting</span>
            </button>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] bg-[var(--surface-soft)] px-6 py-2.5">
          <div className="flex items-center gap-1.5 overflow-x-auto">
            {(
              [
                { id: "ALL", label: "All Events" },
                { id: "MEETING", label: "Google Meets" },
                { id: "TASK_DEADLINE", label: "Task Deadlines" },
                { id: "LEAVE", label: "Leaves" },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilterType(tab.id)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  filterType === tab.id
                    ? "bg-[var(--surface-strong,#ffffff)] text-[var(--accent)] shadow-2xs border border-[var(--border)]"
                    : "text-[var(--text-soft)] hover:text-[var(--text-main)]"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="relative flex items-center">
            <SearchIcon size={14} className="absolute left-2.5 text-[var(--text-soft)]" />
            <input
              type="text"
              placeholder="Search schedule..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 rounded-lg border border-[var(--border)] bg-[var(--surface-strong,#ffffff)] pl-8 pr-3 text-xs text-[var(--text-main)] outline-none focus:border-[var(--accent)] w-56"
            />
          </div>
        </div>

        {/* Calendar Event Cards List */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="py-12 text-center text-xs text-[var(--text-soft)]">Loading events...</div>
          ) : filteredItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--border)] py-16 text-center">
              <CalendarDaysIcon size={32} className="text-[var(--text-soft)] opacity-40 mb-3" />
              <p className="text-sm font-semibold text-[var(--text-main)]">No scheduled events found</p>
              <p className="mt-1 text-xs text-[var(--text-soft)] max-w-sm">
                Click &quot;Meet Now&quot; to start an instant Google Meet call or &quot;Schedule Meeting&quot; to plan a session with attendees.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredItems.map((item) => {
                const date = new Date(item.startAt);
                const isMeeting = item.type === "MEETING";
                const isTask = item.type === "TASK_DEADLINE";
                const isLeave = item.type === "LEAVE";

                return (
                  <div
                    key={item.id}
                    className="flex flex-col justify-between rounded-2xl border border-[var(--border)] bg-[var(--surface-strong,#ffffff)] p-4 shadow-2xs hover:shadow-xs transition"
                  >
                    <div>
                      {/* Badge & Date */}
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span
                          className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                            isMeeting
                              ? "bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300"
                              : isTask
                              ? "bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300"
                              : "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300"
                          }`}
                        >
                          {isMeeting && <VideoIcon size={11} />}
                          {isTask && <ClockIcon size={11} />}
                          {isMeeting ? "Google Meet" : isTask ? "Task Due" : "Leave"}
                        </span>

                        <span className="text-[11px] font-medium text-[var(--text-soft)]">
                          {date.toLocaleDateString(undefined, { month: "short", day: "numeric" })} ·{" "}
                          {date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>

                      {/* Title & Desc */}
                      <h3 className="text-sm font-bold text-[var(--text-main)] line-clamp-1">{item.title}</h3>
                      {item.description && (
                        <p className="mt-1 text-xs text-[var(--text-soft)] line-clamp-2">{item.description}</p>
                      )}

                      {/* Tags */}
                      {item.project && (
                        <div className="mt-2.5 flex items-center gap-1.5 text-[11px] text-[var(--text-soft)] font-medium">
                          <FolderKanbanIcon size={12} />
                          <span>{item.project.name}</span>
                        </div>
                      )}

                      {item.organizer && (
                        <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-[var(--text-soft)]">
                          <span className="font-semibold text-[var(--text-main)]">Host:</span> {item.organizer.name}
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="mt-4 pt-3 border-t border-[var(--border)] flex items-center justify-between gap-2">
                      {item.meetUrl ? (
                        <a
                          href={item.meetUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 transition"
                        >
                          <VideoIcon size={13} />
                          <span>Join Google Meet</span>
                        </a>
                      ) : (
                        <span className="text-[11px] text-[var(--text-soft)] italic">No meet link</span>
                      )}

                      {isMeeting && (
                        <button
                          type="button"
                          onClick={() => handleDeleteEvent(item.id)}
                          className="text-[11px] font-medium text-rose-600 hover:underline"
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Schedule Meeting Modal */}
        {scheduleModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-lg rounded-2xl border border-[var(--border)] bg-[var(--surface-strong,#ffffff)] p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
                <div className="flex items-center gap-2">
                  <VideoIcon size={18} className="text-purple-600" />
                  <h2 className="text-base font-bold text-[var(--text-main)]">Schedule Google Meet Session</h2>
                </div>
                <button
                  type="button"
                  onClick={() => setScheduleModalOpen(false)}
                  className="rounded-lg p-1 text-[var(--text-soft)] hover:bg-[var(--surface-soft)]"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleScheduleSubmit} className="mt-4 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-main)] mb-1">
                    Meeting Title *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Q3 Pipeline Review & Deal Strategy"
                    value={eventTitle}
                    onChange={(e) => setEventTitle(e.target.value)}
                    className="h-9 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] px-3 text-xs text-[var(--text-main)] outline-none focus:border-[var(--accent)]"
                  />
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-xs font-semibold text-[var(--text-main)] mb-1">Date</label>
                    <input
                      type="date"
                      required
                      value={eventDate}
                      onChange={(e) => setEventDate(e.target.value)}
                      className="h-9 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] px-2 text-xs text-[var(--text-main)] outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[var(--text-main)] mb-1">Time</label>
                    <input
                      type="time"
                      required
                      value={eventTime}
                      onChange={(e) => setEventTime(e.target.value)}
                      className="h-9 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] px-2 text-xs text-[var(--text-main)] outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[var(--text-main)] mb-1">Duration</label>
                    <select
                      value={eventDuration}
                      onChange={(e) => setEventDuration(e.target.value)}
                      className="h-9 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] px-2 text-xs text-[var(--text-main)] outline-none"
                    >
                      <option value="15">15 mins</option>
                      <option value="30">30 mins</option>
                      <option value="45">45 mins</option>
                      <option value="60">1 hour</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[var(--text-main)] mb-1">
                    Linked Project (Optional)
                  </label>
                  <select
                    value={selectedProjectId}
                    onChange={(e) => setSelectedProjectId(e.target.value)}
                    className="h-9 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] px-3 text-xs text-[var(--text-main)] outline-none"
                  >
                    <option value="">None (General Meeting)</option>
                    {allProjects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[var(--text-main)] mb-1">
                    Invite Attendees
                  </label>
                  <div className="max-h-32 overflow-y-auto rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] p-2 space-y-1">
                    {allUsers
                      .filter((u) => u.id !== user.id)
                      .map((u) => {
                        const isSelected = selectedAttendeeIds.includes(u.id);
                        return (
                          <label
                            key={u.id}
                            className="flex items-center gap-2 rounded px-2 py-1 text-xs hover:bg-[var(--surface-strong,#ffffff)] cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedAttendeeIds((prev) => [...prev, u.id]);
                                } else {
                                  setSelectedAttendeeIds((prev) => prev.filter((id) => id !== u.id));
                                }
                              }}
                              className="rounded border-[var(--border)]"
                            />
                            <span className="font-medium text-[var(--text-main)]">{u.name}</span>
                            <span className="text-[var(--text-soft)]">({u.role})</span>
                          </label>
                        );
                      })}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[var(--text-main)] mb-1">
                    Description / Agenda
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Topics to discuss, meeting notes..."
                    value={eventDesc}
                    onChange={(e) => setEventDesc(e.target.value)}
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] p-2.5 text-xs text-[var(--text-main)] outline-none"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-[var(--border)]">
                  <button
                    type="button"
                    onClick={() => setScheduleModalOpen(false)}
                    className="rounded-xl border border-[var(--border)] px-4 py-2 text-xs font-semibold text-[var(--text-main)] hover:bg-[var(--surface-soft)]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={schedulingLoading}
                    className="rounded-xl bg-[var(--accent)] px-4 py-2 text-xs font-bold text-white shadow-xs hover:opacity-90 disabled:opacity-50"
                  >
                    {schedulingLoading ? "Scheduling..." : "Create & Send Invites"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </CRMShell>
  );
}
