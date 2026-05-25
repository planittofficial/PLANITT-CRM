"use client";

import { useEffect, useMemo, useState } from "react";
import { CRMShell } from "@/components/layout/crm-shell";
import { useSocket } from "@/components/providers/socket-provider";
import { StatePanel } from "@/components/shared/state-panel";
import { renderSessionGate } from "@/components/shared/session-gate";
import { useSession } from "@/hooks/use-session";
import { useChatMessages } from "@/hooks/use-chat-messages";
import { useChatGroups } from "@/hooks/use-chat-groups";
import { useChatMedia } from "@/hooks/use-chat-media";
import { ChatRoomList } from "@/components/chat/chat-room-list";
import { ChatMessageBubble } from "@/components/chat/chat-message-bubble";
import { CreateGroupModal, GroupSettingsDrawer, MediaPanelDrawer, StartDirectChatModal } from "@/components/chat/chat-modals";
import { apiGet, apiPost } from "@/lib/api";
import { normalizeErrorMessage } from "@/lib/error-message";
import { roomKey } from "@/components/chat/chat-utils";
import type { CRMUser, ChatRoomsResponse } from "@/types/crm";

export default function ChatPage() {
  const { user, loading: sessionLoading, error: sessionError, retry: retrySession } = useSession();
  const { connected } = useSocket();
  const [rooms, setRooms] = useState<ChatRoomsResponse>({ departments: [], projects: [], groups: [] });
  const [selectedKey, setSelectedKey] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [users, setUsers] = useState<CRMUser[]>([]);
  const [draft, setDraft] = useState("");
  const [showStartDirectModal, setShowStartDirectModal] = useState(false);
  const [directTargetUserId, setDirectTargetUserId] = useState("");

  const allRooms = useMemo(() => [...rooms.departments, ...rooms.projects, ...rooms.groups], [rooms]);
  const selectedRoom = allRooms.find((r) => roomKey(r) === selectedKey) ?? null;
  const canManageGroups = user ? ["SUPERADMIN", "ADMIN", "MANAGER"].includes(user.role) : false;
  const canClearChat = canManageGroups;
  const eligibleDirectUsers = useMemo(
    () => users.filter((member) => member.id !== user?.id),
    [users, user?.id]
  );

  const chatAnalytics = useMemo(() => {
    const totalRooms = allRooms.length;
    const unreadTotal = allRooms.reduce((s, r) => s + (r.unreadCount ?? 0), 0);
    const attachmentMessages = 0;
    return { totalRooms, unreadTotal, totalMessages: 0, attachmentMessages };
  }, [allRooms]);

  const refreshRooms = async () => {
    const data = await apiGet<ChatRoomsResponse>("/chat/rooms");
    setRooms(data);
  };

  const messages_ = useChatMessages(selectedRoom, user, setError);

  const groups_ = useChatGroups(setError, refreshRooms);

  const media_ = useChatMedia(selectedRoom, setError, messages_.setMessages);

  useEffect(() => {
    async function loadRooms() {
      try {
        setLoading(true);
        setError("");
        const data = await apiGet<ChatRoomsResponse>("/chat/rooms");
        setRooms(data);
        const first = data.departments[0] ?? data.projects[0] ?? data.groups[0];
        setSelectedKey((cur) => cur || (first ? roomKey(first) : ""));
      } catch (err) {
        setError(normalizeErrorMessage(err, "Failed to load chat rooms"));
      } finally {
        setLoading(false);
      }
    }
    if (user) void loadRooms();
  }, [user]);

  useEffect(() => {
    if (!canManageGroups) return;
    apiGet<CRMUser[]>("/users")
      .then(setUsers)
      .catch(() => setUsers([]));
  }, [canManageGroups]);

  useEffect(() => {
    if (!selectedRoom) return;
    setRooms((cur) => ({
      departments: cur.departments.map((r) =>
        r.id === selectedRoom.id && r.type === selectedRoom.type ? { ...r, unreadCount: 0 } : r,
      ),
      projects: cur.projects.map((r) =>
        r.id === selectedRoom.id && r.type === selectedRoom.type ? { ...r, unreadCount: 0 } : r,
      ),
      groups: cur.groups.map((r) =>
        r.id === selectedRoom.id && r.type === selectedRoom.type ? { ...r, unreadCount: 0 } : r,
      ),
    }));
  }, [selectedRoom?.id]);

  const clearChat = async () => {
    if (!selectedRoom) return;
    try {
      await apiPost<{ success: boolean }>(`/chat/clear/${selectedRoom.type}/${selectedRoom.id}`);
      messages_.setMessages([]);
    } catch (err) {
      setError(normalizeErrorMessage(err, "Failed to clear chat"));
    }
  };

  const sessionGate = renderSessionGate({
    loading: sessionLoading,
    user,
    error: sessionError,
    retry: retrySession,
    loadingTitle: "Loading chat",
    loadingDescription: "Preparing your CRM conversations.",
  });
  if (sessionGate) return sessionGate;
  if (!user) return null;

  return (
    <CRMShell user={user}>
      <div className="grid min-h-[600px] min-w-0 gap-4 overflow-x-hidden xl:h-full xl:min-h-0 xl:grid-cols-[360px_minmax(0,1fr)] xl:overflow-hidden">
        {/* ── Left: rooms list ── */}
        <section
          className="rounded-[22px] border p-4 xl:flex xl:min-h-0 xl:flex-col xl:overflow-hidden"
          style={{ background: "var(--surface)", borderColor: "var(--border)", boxShadow: "var(--shadow-soft)" }}
        >
          <div className="shrink-0">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--text-faint)]">Community</p>
                <h1 className="mt-2 text-2xl font-semibold text-[var(--text-main)]">Team chat</h1>
              </div>
              <span
                className="rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em]"
                style={{
                  background: connected ? "color-mix(in srgb, var(--success) 14%, var(--surface))" : "var(--surface-soft)",
                  color: connected ? "var(--success)" : "var(--text-soft)",
                }}
              >
                {connected ? "Live" : "Offline"}
              </span>
            </div>
            {canManageGroups && (
              <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => {
                    setDirectTargetUserId("");
                    setShowStartDirectModal(true);
                  }}
                  className="rounded-xl border px-4 py-2 text-sm font-semibold"
                  style={{ borderColor: "var(--border)", color: "var(--text-main)" }}
                >
                  + One-to-one
                </button>
                <button
                  type="button"
                  onClick={() => groups_.setShowCreateGroup(true)}
                  className="rounded-xl border px-4 py-2 text-sm font-semibold"
                  style={{ borderColor: "var(--border)", color: "var(--text-main)" }}
                >
                  + Create group
                </button>
              </div>
            )}
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {[
                { label: "Rooms", value: chatAnalytics.totalRooms },
                { label: "Unread", value: chatAnalytics.unreadTotal },
              ].map((item) => (
                <div key={item.label} className="rounded-xl border px-3 py-2" style={{ borderColor: "var(--border)", background: "var(--surface-soft)" }}>
                  <p className="text-[10px] uppercase tracking-[0.16em] text-[var(--text-faint)]">{item.label}</p>
                  <p className="mt-1 text-sm font-semibold text-[var(--text-main)]">{item.value}</p>
                </div>
              ))}
            </div>
            {error && <p className="mt-4 rounded-2xl bg-red-500/10 px-4 py-3 text-sm text-red-600">{error}</p>}
          </div>

          <div className="mt-5 xl:min-h-0 xl:flex-1 xl:overflow-y-auto xl:pr-1">
            <ChatRoomList
              rooms={rooms}
              selectedKey={selectedKey}
              loading={loading}
              onSelect={setSelectedKey}
            />
          </div>
        </section>

        {/* ── Right: chat panel ── */}
        <section
          className="flex min-h-[500px] flex-col overflow-hidden rounded-[22px] border xl:min-h-0"
          style={{ background: "var(--surface)", borderColor: "var(--border)", boxShadow: "var(--shadow-soft)" }}
        >
          {selectedRoom ? (
            <>
              <div className="shrink-0 border-b px-5 py-4" style={{ borderColor: "var(--border)" }}>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--text-faint)]">
                  {selectedRoom.type === "DEPARTMENT" ? "Department room" : selectedRoom.type === "PROJECT" ? "Project room" : "Group room"}
                </p>
                <h2 className="mt-1 text-2xl font-semibold text-[var(--text-main)]">{selectedRoom.name}</h2>
                <p className="mt-1 text-sm text-[var(--text-soft)]">{selectedRoom.subtitle}</p>
                <input
                  value={messages_.search}
                  onChange={(e) => messages_.setSearch(e.target.value)}
                  placeholder="Search messages..."
                  className="mt-3 w-full rounded-xl border px-3 py-2 text-sm outline-none"
                  style={{ borderColor: "var(--border)", background: "var(--surface-soft)", color: "var(--text-main)" }}
                />
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" onClick={() => void media_.openMediaPanel()} className="rounded-lg border px-3 py-1.5 text-xs font-semibold" style={{ borderColor: "var(--border)", color: "var(--text-main)" }}>
                    Media
                  </button>
                  {canClearChat && (
                    <button type="button" onClick={() => void clearChat()} className="rounded-lg border px-3 py-1.5 text-xs font-semibold" style={{ borderColor: "var(--border)", color: "var(--text-main)" }}>
                      Clear chat (local)
                    </button>
                  )}
                  {selectedRoom.type === "GROUP" && canManageGroups && (
                    <button type="button" onClick={() => void groups_.openGroupSettings(selectedRoom)} disabled={Boolean(selectedRoom.isDirect)} className="rounded-lg border px-3 py-1.5 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-60" style={{ borderColor: "var(--border)", color: "var(--text-main)" }}>
                      Group settings
                    </button>
                  )}
                </div>
              </div>

              <div className="flex-1 space-y-3 overflow-y-auto p-5">
                {!messages_.messagesLoading && messages_.hasMoreMessages && (
                  <div className="mb-2 flex justify-center">
                    <button type="button" onClick={() => void messages_.loadOlderMessages()} disabled={messages_.loadingOlderMessages} className="rounded-lg border px-3 py-1.5 text-xs font-semibold disabled:opacity-60" style={{ borderColor: "var(--border)", color: "var(--text-main)", background: "var(--surface-soft)" }}>
                      {messages_.loadingOlderMessages ? "Loading..." : "Load older messages"}
                    </button>
                  </div>
                )}
                {messages_.messagesLoading && <StatePanel title="Loading messages" description="Fetching the latest conversation." />}
                {!messages_.messagesLoading && !messages_.messages.length && (
                  <div className="flex h-full items-center justify-center">
                    <p className="max-w-sm text-center text-sm text-[var(--text-soft)]">No messages yet. Start the conversation for this room.</p>
                  </div>
                )}
                {messages_.filteredMessages.map((message) => (
                  <ChatMessageBubble
                    key={message.id}
                    message={message}
                    user={user}
                    openMenuId={messages_.openMenuId}
                    onOpenMenu={messages_.setOpenMenuId}
                    onReply={messages_.setReplyTo}
                    onDeleteForMe={(id) => void messages_.deleteMessage(id, "me")}
                    onDeleteForEveryone={(id) => void messages_.deleteMessage(id, "everyone")}
                  />
                ))}
                <div ref={messages_.messageEndRef} />
              </div>

              <div className="shrink-0 border-t p-4" style={{ borderColor: "var(--border)" }}>
                {messages_.replyTo && (
                  <div className="mb-3 flex items-center justify-between rounded-xl border px-3 py-2 text-sm" style={{ borderColor: "var(--border)" }}>
                    <div>
                      <p className="font-semibold text-[var(--text-main)]">Replying to {messages_.replyTo.author.name}</p>
                      <p className="text-[var(--text-soft)]">{messages_.replyTo.isDeleted ? "This message was deleted" : messages_.replyTo.content || messages_.replyTo.attachmentFileName || "Attachment"}</p>
                    </div>
                    <button type="button" className="text-[var(--text-soft)]" onClick={() => messages_.setReplyTo(null)}>Cancel</button>
                  </div>
                )}
                {messages_.selectedFile && (
                  <div className="mb-3 flex items-center justify-between rounded-xl border px-3 py-2 text-sm" style={{ borderColor: "var(--border)" }}>
                    <p className="truncate text-[var(--text-main)]">Attached: {messages_.selectedFile.name}</p>
                    <button type="button" className="text-[var(--text-soft)]" onClick={() => messages_.setSelectedFile(null)}>Remove</button>
                  </div>
                )}
                <div className="flex items-center gap-3">
                  <input ref={messages_.fileInputRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => messages_.setSelectedFile(e.target.files?.[0] ?? null)} />
                  <button type="button" onClick={() => messages_.fileInputRef.current?.click()} className="h-11 w-11 rounded-full border text-2xl leading-none" style={{ borderColor: "var(--border)", color: "var(--text-main)", background: "var(--surface-soft)" }}>+</button>
                  <textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void messages_.sendMessage(draft, () => setDraft("")); } }}
                    placeholder="Write a message..."
                    className="min-h-12 flex-1 resize-none rounded-full border px-5 py-3 text-sm outline-none"
                    style={{ borderColor: "var(--border)", background: "var(--surface-soft)", color: "var(--text-main)" }}
                  />
                  <button type="button" onClick={() => void messages_.sendMessage(draft, () => setDraft(""))} disabled={messages_.sending || (!draft.trim() && !messages_.selectedFile)} className="h-11 rounded-full px-5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60" style={{ background: "var(--accent)" }}>
                    {messages_.sending ? "Sending..." : "Send"}
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center p-6">
              <StatePanel title="No chat rooms" description="Create a department or project to start a community room." />
            </div>
          )}
        </section>
      </div>

      {groups_.showCreateGroup && (
        <CreateGroupModal
          groupName={groups_.groupName}
          groupDescription={groups_.groupDescription}
          groupMemberIds={groups_.groupMemberIds}
          users={users}
          saving={groups_.groupSaving}
          onClose={() => groups_.setShowCreateGroup(false)}
          onChangeName={groups_.setGroupName}
          onChangeDesc={groups_.setGroupDescription}
          onToggleMember={(id, checked) =>
            groups_.setGroupMemberIds((c) => (checked ? [...c, id] : c.filter((x) => x !== id)))
          }
          onSubmit={() => void groups_.createGroup()}
        />
      )}
      {groups_.showGroupSettings && groups_.activeGroup && (
        <GroupSettingsDrawer
          activeGroup={groups_.activeGroup}
          members={groups_.activeGroupMembers}
          allUsers={users}
          saving={groups_.groupSaving}
          onClose={() => groups_.setShowGroupSettings(false)}
          onChangeName={(v) => groups_.setActiveGroup((g) => (g ? { ...g, name: v } : g))}
          onChangeDesc={(v) => groups_.setActiveGroup((g) => (g ? { ...g, description: v } : g))}
          onSave={() => void groups_.updateGroup()}
          onRemoveMember={(id) => void groups_.removeMember(id)}
          onAddMember={(id) => void groups_.addMembers([id])}
          onDelete={() => void groups_.deleteGroup(setSelectedKey)}
        />
      )}
      {media_.showMediaPanel && selectedRoom && (
        <MediaPanelDrawer
          room={selectedRoom}
          user={user}
          mediaFilter={media_.mediaFilter}
          mediaItems={media_.mediaItems}
          mediaLoading={media_.mediaLoading}
          mediaDeletingId={media_.mediaDeletingId}
          selectedMediaIds={media_.selectedMediaIds}
          bulkDeleting={media_.bulkDeletingMedia}
          onClose={() => media_.setShowMediaPanel(false)}
          onChangeFilter={(f) => void media_.changeMediaFilter(f)}
          onToggleSelect={media_.toggleMediaSelection}
          onDeleteOne={(id) => void media_.deleteMedia(id)}
          onDeleteSelected={() => void media_.deleteSelectedMedia()}
        />
      )}
      {showStartDirectModal && canManageGroups ? (
        <StartDirectChatModal
          users={eligibleDirectUsers}
          selectedUserId={directTargetUserId}
          saving={groups_.groupSaving}
          onClose={() => setShowStartDirectModal(false)}
          onChangeUserId={setDirectTargetUserId}
          onSubmit={async () => {
            if (!directTargetUserId) return;
            await groups_.startDirectChat(directTargetUserId);
            await refreshRooms();
            const latest = await apiGet<ChatRoomsResponse>("/chat/rooms");
            const directRoom = latest.groups.find((room) => room.isDirect && room.directPeer?.id === directTargetUserId);
            if (directRoom) {
              setSelectedKey(roomKey(directRoom));
            }
            setShowStartDirectModal(false);
            setDirectTargetUserId("");
          }}
        />
      ) : null}
    </CRMShell>
  );
}
