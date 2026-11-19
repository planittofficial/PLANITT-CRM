"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { CRMShell } from "@/components/layout/crm-shell";
import { useSession } from "@/hooks/use-session";
import { renderSessionGate } from "@/components/shared/session-gate";
import { usePresence } from "@/components/providers/presence-provider";
import { Avatar } from "@/components/ui/avatar";
import { apiGet, apiPost } from "@/lib/api";
import { showToast } from "@/hooks/use-toast";
import {
  UsersIcon,
  HashIcon,
  VideoIcon,
  PlusIcon,
  FolderKanbanIcon,
  PaperclipIcon,
  SmileIcon,
  SendIcon,
  Building2Icon,
  CheckSquareIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  ArrowLeftIcon,
} from "@/components/ui/icons";
import type { Department, Project, TeamChannel, ChannelMessage, CRMUser, Task } from "@/types/crm";

export default function TeamsPage() {
  const { user, loading: sessionLoading, error: sessionError, retry: retrySession } = useSession();
  const { getUserPresence, setMeetingStatus } = usePresence();

  const [departments, setDepartments] = useState<Department[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedParent, setSelectedParent] = useState<{ type: "DEPARTMENT" | "PROJECT"; id: string; name: string } | null>(null);
  const [channels, setChannels] = useState<TeamChannel[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<TeamChannel | null>(null);
  const [messages, setMessages] = useState<ChannelMessage[]>([]);
  const [channelTasks, setChannelTasks] = useState<Task[]>([]);
  const [channelTab, setChannelTab] = useState<"posts" | "files" | "tasks">("posts");
  const [mobileView, setMobileView] = useState<"tree" | "channel">("tree");

  const [messageDraft, setMessageDraft] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);
  const [createChannelOpen, setCreateChannelOpen] = useState(false);
  const [newChannelName, setNewChannelName] = useState("");
  const [newChannelDesc, setNewChannelDesc] = useState("");
  const [loadingChannels, setLoadingChannels] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const messagesContainerRef = useRef<HTMLDivElement | null>(null);

  const scrollToBottom = () => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  };

  // Load Departments and Projects on start
  useEffect(() => {
    if (user) {
      Promise.all([
        apiGet<Department[]>("/departments"),
        apiGet<Project[]>("/projects"),
      ])
        .then(([depts, projs]) => {
          setDepartments(depts);
          setProjects(projs);
          if (depts.length > 0) {
            setSelectedParent({ type: "DEPARTMENT", id: depts[0].id, name: depts[0].name });
          } else if (projs.length > 0) {
            setSelectedParent({ type: "PROJECT", id: projs[0].id, name: projs[0].name });
          }
        })
        .catch(() => {
          showToast("Failed to load teams", "error");
        });
    }
  }, [user]);

  // Load Channels when parent changes
  useEffect(() => {
    if (!selectedParent) return;
    setLoadingChannels(true);

    const query = selectedParent.type === "DEPARTMENT" ? `departmentId=${selectedParent.id}` : `projectId=${selectedParent.id}`;
    apiGet<TeamChannel[]>(`/channels?${query}`)
      .then((chs) => {
        setChannels(chs);
        if (chs.length > 0) {
          setSelectedChannel(chs[0]);
        } else {
          setSelectedChannel(null);
        }
      })
      .catch(() => {
        showToast("Failed to load channels", "error");
      })
      .finally(() => {
        setLoadingChannels(false);
      });
  }, [selectedParent]);

  // Load Messages and Tasks when selected channel changes
  useEffect(() => {
    if (!selectedChannel) {
      setMessages([]);
      return;
    }
    setLoadingMessages(true);
    apiGet<ChannelMessage[]>(`/channels/${selectedChannel.id}/messages`)
      .then((msgs) => {
        setMessages(msgs);
        setTimeout(scrollToBottom, 60);
      })
      .catch(() => {})
      .finally(() => setLoadingMessages(false));

    // Load tasks if linked to project
    if (selectedChannel.projectId) {
      apiGet<Task[]>(`/tasks?projectId=${selectedChannel.projectId}`)
        .then(setChannelTasks)
        .catch(() => {});
    }
  }, [selectedChannel]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedChannel || !messageDraft.trim()) return;

    try {
      setSendingMessage(true);
      const newMsg = await apiPost<ChannelMessage>(`/channels/${selectedChannel.id}/messages`, {
        content: messageDraft.trim(),
        messageType: "TEXT",
      });
      setMessages((prev) => [...prev, newMsg]);
      setMessageDraft("");
      setTimeout(scrollToBottom, 30);
    } catch (err) {
      showToast("Failed to send message", "error");
    } finally {
      setSendingMessage(false);
    }
  };

  const handleLaunchChannelMeet = async () => {
    if (!selectedChannel) return;
    try {
      const res = await apiPost<{ meetUrl: string }>("/calendar/quick-meet", {
        title: `${selectedParent?.name} - #${selectedChannel.name} Team Huddle`,
        channelId: selectedChannel.id,
        projectId: selectedChannel.projectId || undefined,
      });
      if (res.meetUrl) {
        window.open(res.meetUrl, "_blank");
        await navigator.clipboard.writeText(res.meetUrl).catch(() => {});
        showToast("Google Meet session started and posted to channel!", "success");
        // Reload messages to show meet card
        apiGet<ChannelMessage[]>(`/channels/${selectedChannel.id}/messages`).then(setMessages);
      }
    } catch (err) {
      showToast("Failed to start channel Google Meet", "error");
    }
  };

  const handleCreateChannelSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedParent || !newChannelName.trim()) return;

    try {
      const created = await apiPost<TeamChannel>("/channels", {
        name: newChannelName.trim(),
        description: newChannelDesc.trim() || null,
        departmentId: selectedParent.type === "DEPARTMENT" ? selectedParent.id : undefined,
        projectId: selectedParent.type === "PROJECT" ? selectedParent.id : undefined,
      });
      setChannels((prev) => [...prev, created]);
      setSelectedChannel(created);
      setCreateChannelOpen(false);
      setNewChannelName("");
      setNewChannelDesc("");
      showToast(`Channel #${created.name} created!`, "success");
    } catch (err) {
      showToast("Failed to create channel", "error");
    }
  };

  const handleReaction = async (messageId: string, emoji: string) => {
    try {
      const res = await apiPost<{ reactions: Record<string, string[]> }>(`/channels/messages/${messageId}/reaction`, { emoji });
      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, reactions: res.reactions } : m))
      );
    } catch (err) {
      showToast("Failed to react", "error");
    }
  };

  if (sessionLoading || sessionError || !user) {
    return renderSessionGate({ loading: sessionLoading, user, error: sessionError, retry: retrySession });
  }

  return (
    <CRMShell user={user} fullBleed>
      <div className="flex h-full w-full min-h-0 overflow-hidden bg-[var(--app-bg)]">
        {/* ── LEFT PANE: TEAMS & CHANNELS TREE ────────────────────────────── */}
        <aside
          className={`shrink-0 border-r border-[var(--border)] bg-[var(--surface-strong,#ffffff)] flex-col justify-between min-h-0 ${
            mobileView === "tree" ? "flex w-full flex-1" : "hidden"
          } md:flex md:w-64 md:shrink-0`}
        >
          <div className="flex flex-col min-h-0 h-full">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3 shrink-0">
              <span className="text-xs font-bold text-[var(--text-main)] uppercase tracking-wider">
                Teams & Channels
              </span>
              <div className="flex items-center gap-1.5">
                {selectedChannel && (
                  <button
                    type="button"
                    onClick={() => setMobileView("channel")}
                    className="md:hidden inline-flex items-center gap-1 rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] px-2 py-1 text-[11px] font-semibold text-[var(--accent)] hover:bg-[var(--surface-hover)] active:scale-95 transition"
                    title="Return to active channel"
                  >
                    <span>#{selectedChannel.name}</span>
                    <ChevronRightIcon size={12} />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setCreateChannelOpen(true)}
                  title="Create Channel"
                  className="rounded-lg p-1.5 text-[var(--text-soft)] hover:bg-[var(--surface-soft)] hover:text-[var(--text-main)] transition"
                >
                  <PlusIcon size={16} />
                </button>
              </div>
            </div>

            {/* Tree Navigation */}
            <div className="overflow-y-auto p-2 space-y-4 flex-1 min-h-0">
              {/* Departments Section */}
              <div>
                <p className="px-2 text-[10px] font-bold uppercase tracking-wider text-[var(--text-faint)] mb-1">
                  Department Teams
                </p>
                <div className="space-y-0.5">
                  {departments.map((dept) => {
                    const isParentSelected = selectedParent?.type === "DEPARTMENT" && selectedParent.id === dept.id;
                    return (
                      <div key={dept.id}>
                        <button
                          type="button"
                          onClick={() => setSelectedParent({ type: "DEPARTMENT", id: dept.id, name: dept.name })}
                          className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs font-bold transition ${
                            isParentSelected
                              ? "bg-[var(--surface-soft)] text-[var(--accent)]"
                              : "text-[var(--text-main)] hover:bg-[var(--surface-soft)]"
                          }`}
                        >
                          <div className="flex items-center gap-2 truncate">
                            <Building2Icon size={14} className="text-[var(--accent)] shrink-0" />
                            <span className="truncate">{dept.name}</span>
                          </div>
                          {isParentSelected ? <ChevronDownIcon size={12} /> : <ChevronRightIcon size={12} />}
                        </button>

                        {/* Nested Channels */}
                        {isParentSelected && (
                          <div className="ml-4 mt-0.5 pl-2 border-l border-[var(--border)] space-y-0.5">
                            {channels.map((ch) => (
                              <button
                                key={ch.id}
                                type="button"
                                onClick={() => {
                                  setSelectedChannel(ch);
                                  setMobileView("channel");
                                }}
                                className={`flex w-full items-center gap-2 rounded-md px-2 py-1 text-xs font-medium transition ${
                                  selectedChannel?.id === ch.id
                                    ? "bg-[var(--accent)] text-white shadow-2xs font-semibold"
                                    : "text-[var(--text-soft)] hover:bg-[var(--surface-soft)] hover:text-[var(--text-main)]"
                                }`}
                              >
                                <HashIcon size={12} />
                                <span className="truncate">{ch.name}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Projects Section */}
              <div>
                <p className="px-2 text-[10px] font-bold uppercase tracking-wider text-[var(--text-faint)] mb-1">
                  Project Workspaces
                </p>
                <div className="space-y-0.5">
                  {projects.map((proj) => {
                    const isParentSelected = selectedParent?.type === "PROJECT" && selectedParent.id === proj.id;
                    return (
                      <div key={proj.id}>
                        <button
                          type="button"
                          onClick={() => setSelectedParent({ type: "PROJECT", id: proj.id, name: proj.name })}
                          className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs font-bold transition ${
                            isParentSelected
                              ? "bg-[var(--surface-soft)] text-[var(--accent)]"
                              : "text-[var(--text-main)] hover:bg-[var(--surface-soft)]"
                          }`}
                        >
                          <div className="flex items-center gap-2 truncate">
                            <FolderKanbanIcon size={14} className="text-purple-600 shrink-0" />
                            <span className="truncate">{proj.name}</span>
                          </div>
                          {isParentSelected ? <ChevronDownIcon size={12} /> : <ChevronRightIcon size={12} />}
                        </button>

                        {/* Nested Channels */}
                        {isParentSelected && (
                          <div className="ml-4 mt-0.5 pl-2 border-l border-[var(--border)] space-y-0.5">
                            {channels.map((ch) => (
                              <button
                                key={ch.id}
                                type="button"
                                onClick={() => {
                                  setSelectedChannel(ch);
                                  setMobileView("channel");
                                }}
                                className={`flex w-full items-center gap-2 rounded-md px-2 py-1 text-xs font-medium transition ${
                                  selectedChannel?.id === ch.id
                                    ? "bg-[var(--accent)] text-white shadow-2xs font-semibold"
                                    : "text-[var(--text-soft)] hover:bg-[var(--surface-soft)] hover:text-[var(--text-main)]"
                                }`}
                              >
                                <HashIcon size={12} />
                                <span className="truncate">{ch.name}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </aside>

        {/* ── RIGHT MAIN PANE: ACTIVE CHANNEL ──────────────────────────────── */}
        <main
          className={`flex-col min-w-0 min-h-0 bg-[var(--app-bg)] ${
            mobileView === "channel" ? "flex flex-1 w-full" : "hidden"
          } md:flex md:flex-1`}
        >
          {selectedChannel ? (
            <>
              {/* Channel Top Header */}
              <div className="border-b border-[var(--border)] bg-[var(--surface-strong,#ffffff)] px-3 sm:px-6 py-2.5 sm:py-3 shrink-0">
                <div className="flex items-center justify-between gap-2 sm:gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <button
                      type="button"
                      onClick={() => setMobileView("tree")}
                      aria-label="Back to Teams and Channels"
                      className="md:hidden inline-flex h-8 items-center gap-1 rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] px-2 text-xs font-semibold text-[var(--text-main)] hover:bg-[var(--surface-hover)] active:scale-95 transition shrink-0"
                    >
                      <ArrowLeftIcon size={14} />
                      <span className="text-[11px]">Teams</span>
                    </button>

                    <HashIcon size={18} className="text-[var(--accent)] shrink-0" />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h2 className="text-sm font-bold text-[var(--text-main)] truncate max-w-[130px] sm:max-w-none">
                          {selectedChannel.name}
                        </h2>
                        {selectedParent && (
                          <span className="rounded bg-[var(--surface-soft)] border border-[var(--border)] px-1.5 py-0.5 text-[10px] text-[var(--text-soft)] truncate max-w-[110px] sm:max-w-none">
                            {selectedParent.name}
                          </span>
                        )}
                      </div>
                      {selectedChannel.description && (
                        <p className="text-[11px] text-[var(--text-soft)] truncate">
                          {selectedChannel.description}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Top Action: Meet Now */}
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={handleLaunchChannelMeet}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-purple-600 px-2.5 sm:px-3 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-purple-700 transition shrink-0"
                      title="Start Google Meet with everyone in this channel"
                    >
                      <VideoIcon size={14} />
                      <span className="hidden sm:inline">Meet Now</span>
                      <span className="sm:hidden text-[11px]">Meet</span>
                    </button>
                  </div>
                </div>

                {/* Channel Navigation Tabs */}
                <div className="flex gap-3 sm:gap-4 mt-2 sm:mt-3 border-t border-[var(--border)] pt-2 text-xs font-semibold overflow-x-auto no-scrollbar">
                  <button
                    type="button"
                    onClick={() => setChannelTab("posts")}
                    className={`transition pb-1 whitespace-nowrap shrink-0 ${
                      channelTab === "posts"
                        ? "border-b-2 border-[var(--accent)] text-[var(--accent)]"
                        : "text-[var(--text-soft)] hover:text-[var(--text-main)]"
                    }`}
                  >
                    Posts & Chat
                  </button>
                  <button
                    type="button"
                    onClick={() => setChannelTab("files")}
                    className={`transition pb-1 whitespace-nowrap shrink-0 ${
                      channelTab === "files"
                        ? "border-b-2 border-[var(--accent)] text-[var(--accent)]"
                        : "text-[var(--text-soft)] hover:text-[var(--text-main)]"
                    }`}
                  >
                    Google Drive Files
                  </button>
                  {selectedChannel.projectId && (
                    <button
                      type="button"
                      onClick={() => setChannelTab("tasks")}
                      className={`transition pb-1 whitespace-nowrap shrink-0 ${
                        channelTab === "tasks"
                          ? "border-b-2 border-[var(--accent)] text-[var(--accent)]"
                          : "text-[var(--text-soft)] hover:text-[var(--text-main)]"
                      }`}
                    >
                      Project Tasks ({channelTasks.length})
                    </button>
                  )}
                </div>
              </div>

              {/* ── TAB 1: POSTS & STREAM ──────────────────────────────────── */}
              {channelTab === "posts" && (
                <div className="flex-1 flex flex-col min-h-0">
                  {/* Messages Feed */}
                  <div ref={messagesContainerRef} className="flex-1 overflow-y-auto p-3 sm:p-6 space-y-3 sm:space-y-4 min-h-0">
                    {loadingMessages ? (
                      <div className="py-12 text-center text-xs text-[var(--text-soft)]">
                        Loading messages...
                      </div>
                    ) : messages.length === 0 ? (
                      <div className="py-12 text-center">
                        <HashIcon size={32} className="mx-auto text-[var(--text-soft)] opacity-40 mb-2" />
                        <p className="text-sm font-bold text-[var(--text-main)]">
                          Welcome to #{selectedChannel.name}
                        </p>
                        <p className="text-xs text-[var(--text-soft)] mt-1">
                          This is the start of the #{selectedChannel.name} channel. Start the discussion or click &quot;Meet Now&quot; to begin a team video huddle.
                        </p>
                      </div>
                    ) : (
                      messages.map((msg) => {
                        const isMeeting = msg.messageType === "MEETING";
                        const date = new Date(msg.createdAt);
                        const authorPresence = getUserPresence(msg.author.id);
                        const authorStatus = authorPresence?.status;
                        const authorCustomMsg = authorPresence?.customStatusMessage;

                        return (
                          <div
                            key={msg.id}
                            className={`flex gap-2.5 sm:gap-3 rounded-2xl border p-3 sm:p-4 shadow-2xs transition ${
                              isMeeting
                                ? "border-purple-200 bg-purple-50/60 dark:border-purple-900 dark:bg-purple-950/20"
                                : "border-[var(--border)] bg-[var(--surface-strong,#ffffff)]"
                            }`}
                          >
                            <Avatar
                              name={msg.author.name}
                              avatarUrl={msg.author.avatarUrl}
                              size="md"
                              status={authorStatus}
                              statusTitle={`${msg.author.name}${authorStatus ? ` (${authorStatus})` : ""}${authorCustomMsg ? ` - "${authorCustomMsg}"` : ""}`}
                            />

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs font-bold text-[var(--text-main)]">
                                  {msg.author.name}
                                </span>
                                {authorCustomMsg && (
                                  <span className="rounded bg-[var(--surface-soft)] px-1.5 py-0.5 text-[10px] text-[var(--text-soft)] italic truncate max-w-[140px] sm:max-w-[200px]" title={authorCustomMsg}>
                                    "{authorCustomMsg}"
                                  </span>
                                )}
                                <span className="text-[10px] text-[var(--text-soft)]">
                                  {date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                </span>
                              </div>

                              {/* Google Meet Meeting Card */}
                              {isMeeting && msg.meetingUrl ? (
                                <div className="mt-2 rounded-xl border border-purple-300 dark:border-purple-800 bg-[var(--surface-strong,#ffffff)] p-3.5">
                                  <div className="flex items-center gap-2 text-purple-700 dark:text-purple-300 font-bold text-xs">
                                    <VideoIcon size={16} />
                                    <span>{msg.meetingTitle || "Instant Google Meet Session"}</span>
                                  </div>
                                  <p className="text-[11px] text-[var(--text-soft)] mt-1">
                                    Google Meet video call started. Click to join the room.
                                  </p>
                                  <div className="mt-3 flex items-center gap-2">
                                    <a
                                      href={msg.meetingUrl}
                                      target="_blank"
                                      rel="noreferrer"
                                      onClick={async () => {
                                        await setMeetingStatus(msg.meetingTitle || "Google Meet Session");
                                        showToast("Joined meeting! Status automatically set to In a Meeting (🔴)", "success");
                                      }}
                                      className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 transition"
                                    >
                                      <VideoIcon size={13} />
                                      <span>Join Google Meet</span>
                                    </a>
                                  </div>
                                </div>
                              ) : (
                                <p className="mt-1 text-xs text-[var(--text-main)] whitespace-pre-wrap leading-relaxed break-words">
                                  {msg.content}
                                </p>
                              )}

                              {/* Emoji Reactions Bar */}
                              <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                                {["👍", "❤️", "🚀", "🎉"].map((emoji) => {
                                  const count = msg.reactions?.[emoji]?.length || 0;
                                  return (
                                    <button
                                      key={emoji}
                                      type="button"
                                      onClick={() => handleReaction(msg.id, emoji)}
                                      className={`rounded-full border border-[var(--border)] px-2 py-0.5 text-[11px] transition ${
                                        count > 0 ? "bg-[var(--surface-soft)] font-bold text-[var(--accent)]" : "text-[var(--text-soft)] hover:bg-[var(--surface-soft)]"
                                      }`}
                                    >
                                      {emoji} {count > 0 && count}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                    <div ref={messagesEndRef} />
                  </div>

                  {/* Channel Message Composer */}
                  <div className="border-t border-[var(--border)] bg-[var(--surface-strong,#ffffff)] p-3 sm:p-4 shrink-0">
                    <form onSubmit={handleSendMessage} className="space-y-2">
                      <div className="relative">
                        <textarea
                          rows={2}
                          value={messageDraft}
                          onChange={(e) => setMessageDraft(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                              e.preventDefault();
                              handleSendMessage(e);
                            }
                          }}
                          placeholder={`Message #${selectedChannel.name}...`}
                          className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] p-2.5 sm:p-3 text-xs text-[var(--text-main)] outline-none focus:border-[var(--accent)] resize-none"
                        />
                      </div>

                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1 text-[var(--text-soft)]">
                          <button
                            type="button"
                            onClick={handleLaunchChannelMeet}
                            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs hover:bg-[var(--surface-soft)] hover:text-purple-600 transition"
                            title="Start Instant Google Meet"
                          >
                            <VideoIcon size={14} />
                            <span className="font-semibold text-[11px]">Meet</span>
                          </button>
                        </div>

                        <button
                          type="submit"
                          disabled={sendingMessage || !messageDraft.trim()}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--accent)] px-3.5 py-1.5 text-xs font-bold text-white hover:opacity-90 transition disabled:opacity-40 shrink-0"
                        >
                          <SendIcon size={13} />
                          <span>Send</span>
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}

              {/* ── TAB 2: GOOGLE DRIVE FILES ──────────────────────────────── */}
              {channelTab === "files" && (
                <div className="flex-1 min-h-0 p-3 sm:p-6 overflow-y-auto">
                  <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-strong,#ffffff)] p-4 sm:p-6 shadow-2xs">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[var(--border)] pb-4 mb-4">
                      <div>
                        <h3 className="text-sm font-bold text-[var(--text-main)]">Google Drive Workspace</h3>
                        <p className="text-xs text-[var(--text-soft)]">
                          Shared project documentation, client specs, and deliverables
                        </p>
                      </div>
                      <a
                        href="https://drive.google.com"
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-3.5 py-2 text-xs font-bold text-white shadow-xs hover:bg-blue-700 transition"
                      >
                        Open Google Drive
                      </a>
                    </div>

                    <div className="py-8 text-center text-xs text-[var(--text-soft)]">
                      Google Drive folder connected for {selectedParent?.name}. Uploaded assets and generated project sheets sync directly here.
                    </div>
                  </div>
                </div>
              )}

              {/* ── TAB 3: PROJECT TASKS ───────────────────────────────────── */}
              {channelTab === "tasks" && (
                <div className="flex-1 min-h-0 p-3 sm:p-6 overflow-y-auto space-y-3">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-bold text-[var(--text-main)]">Linked Project Tasks</h3>
                    <span className="text-xs text-[var(--text-soft)]">{channelTasks.length} tasks</span>
                  </div>

                  {channelTasks.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-[var(--border)] py-12 text-center text-xs text-[var(--text-soft)]">
                      No active tasks in this project yet.
                    </div>
                  ) : (
                    channelTasks.map((t) => (
                      <div
                        key={t.id}
                        className="flex items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--surface-strong,#ffffff)] p-3 sm:p-3.5 shadow-2xs gap-3"
                      >
                        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                          <CheckSquareIcon size={16} className="text-[var(--accent)] shrink-0" />
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-[var(--text-main)] truncate">{t.title}</p>
                            <span className="text-[10px] text-[var(--text-soft)]">Progress: {t.progress}%</span>
                          </div>
                        </div>
                        <span className="rounded bg-[var(--surface-soft)] border border-[var(--border)] px-2 py-0.5 text-[10px] font-bold shrink-0">
                          {t.status}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              )}
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-6 sm:p-8 text-center">
              <UsersIcon size={40} className="text-[var(--text-soft)] opacity-30 mb-3" />
              <p className="text-sm font-bold text-[var(--text-main)]">Select a Team & Channel</p>
              <p className="text-xs text-[var(--text-soft)] mt-1 max-w-sm">
                Choose a Department or Project channel from the list to collaborate with your team.
              </p>
              <button
                type="button"
                onClick={() => setMobileView("tree")}
                className="mt-4 md:hidden inline-flex items-center gap-1.5 rounded-xl bg-[var(--accent)] px-3.5 py-2 text-xs font-semibold text-white shadow-xs active:scale-95 transition"
              >
                <ArrowLeftIcon size={14} />
                <span>Browse Teams & Channels</span>
              </button>
            </div>
          )}
        </main>

        {/* Create Channel Modal */}
        {createChannelOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-sm rounded-2xl border border-[var(--border)] bg-[var(--surface-strong,#ffffff)] p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
                <h3 className="text-sm font-bold text-[var(--text-main)]">Create Channel</h3>
                <button
                  type="button"
                  onClick={() => setCreateChannelOpen(false)}
                  className="rounded-lg p-1 text-[var(--text-soft)] hover:bg-[var(--surface-soft)]"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleCreateChannelSubmit} className="mt-4 space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-main)] mb-1">Channel Name *</label>
                  <div className="flex items-center rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] px-2.5">
                    <HashIcon size={14} className="text-[var(--text-soft)]" />
                    <input
                      type="text"
                      required
                      placeholder="e.g. client-updates"
                      value={newChannelName}
                      onChange={(e) => setNewChannelName(e.target.value)}
                      className="h-8 w-full bg-transparent pl-2 text-xs text-[var(--text-main)] outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[var(--text-main)] mb-1">Description</label>
                  <input
                    type="text"
                    placeholder="Topic or purpose of this channel"
                    value={newChannelDesc}
                    onChange={(e) => setNewChannelDesc(e.target.value)}
                    className="h-8 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] px-2.5 text-xs text-[var(--text-main)] outline-none"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-[var(--border)]">
                  <button
                    type="button"
                    onClick={() => setCreateChannelOpen(false)}
                    className="rounded-xl border border-[var(--border)] px-3 py-1.5 text-xs font-semibold text-[var(--text-main)] hover:bg-[var(--surface-soft)]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="rounded-xl bg-[var(--accent)] px-3.5 py-1.5 text-xs font-bold text-white shadow-xs hover:opacity-90"
                  >
                    Create
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
