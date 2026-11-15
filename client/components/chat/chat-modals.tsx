"use client";

import type {
  CRMUser,
  ChatGroup,
  ChatGroupMember,
  ChatMessage,
  ChatMediaTypeFilter,
  ChatRoom,
} from "@/types/crm";
import { UserAvatar } from "@/components/shared/user-avatar";
import { ResponsiveSelect } from "../shared/responsive-select";
import { formatTime, resolveAttachmentUrl } from "./chat-utils";

/* ─── Create Group Modal ─────────────────────────────────── */

type CreateGroupProps = {
  groupName: string;
  groupDescription: string;
  groupMemberIds: string[];
  users: CRMUser[];
  saving: boolean;
  onClose: () => void;
  onChangeName: (v: string) => void;
  onChangeDesc: (v: string) => void;
  onToggleMember: (id: string, checked: boolean) => void;
  onSubmit: () => void;
};

type StartDirectChatProps = {
  users: CRMUser[];
  selectedUserId: string;
  saving: boolean;
  onClose: () => void;
  onChangeUserId: (value: string) => void;
  onSubmit: () => void;
};

export function CreateGroupModal({
  groupName,
  groupDescription,
  groupMemberIds,
  users,
  saving,
  onClose,
  onChangeName,
  onChangeDesc,
  onToggleMember,
  onSubmit,
}: CreateGroupProps) {
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 backdrop-blur-2xs p-0 sm:items-center sm:p-4">
      <div
        className="max-h-[92dvh] w-full max-w-[95vw] overflow-y-auto rounded-t-xl sm:rounded-xl border border-[var(--border)] bg-[var(--surface-strong,#ffffff)] p-4 sm:p-5 sm:max-w-md shadow-xl"
      >
        <h3 className="text-base font-bold text-[var(--text-main)]">Create New Channel</h3>
        <p className="mt-0.5 text-xs text-[var(--text-soft)]">Collaborate with multiple team members across departments.</p>

        <input
          value={groupName}
          onChange={(e) => onChangeName(e.target.value)}
          placeholder="Channel name (e.g. general, design-reviews)"
          className="mt-3.5 w-full rounded-md border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2 text-xs text-[var(--text-main)] outline-none focus:border-[var(--accent)]"
        />
        <input
          value={groupDescription}
          onChange={(e) => onChangeDesc(e.target.value)}
          placeholder="Channel purpose (optional)"
          className="mt-2 w-full rounded-md border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2 text-xs text-[var(--text-main)] outline-none focus:border-[var(--accent)]"
        />

        <p className="mt-3 text-xs font-semibold text-[var(--text-main)]">Add Members</p>
        <div
          className="mt-1.5 max-h-48 overflow-y-auto rounded-md border border-[var(--border)] bg-[var(--surface)] p-2 space-y-1"
        >
          {users.map((member) => (
            <label
              key={member.id}
              className="flex items-center gap-2.5 rounded px-2 py-1 text-xs hover:bg-[var(--surface-soft)] cursor-pointer"
            >
              <input
                type="checkbox"
                checked={groupMemberIds.includes(member.id)}
                onChange={(e) => onToggleMember(member.id, e.target.checked)}
                className="rounded"
              />
              <UserAvatar
                name={member.name}
                avatarUrl={member.avatarUrl}
                authProvider={member.authProvider}
                className="h-6 w-6 shrink-0 rounded-full text-[9px]"
              />
              <div className="min-w-0 flex-1 truncate">
                <span className="font-medium text-[var(--text-main)]">{member.name}</span>
                <span className="ml-1.5 text-[10px] text-[var(--text-faint)]">({member.role})</span>
              </div>
            </label>
          ))}
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-[var(--border)] px-3 py-1.5 text-xs font-semibold text-[var(--text-soft)] hover:bg-[var(--surface-soft)] transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={saving || !groupName.trim()}
            onClick={onSubmit}
            className="rounded-md bg-[var(--accent)] hover:bg-[var(--accent-strong)] px-3.5 py-1.5 text-xs font-semibold text-white transition-colors disabled:opacity-50"
          >
            {saving ? "Creating..." : "Create Channel"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function StartDirectChatModal({
  users,
  selectedUserId,
  saving,
  onClose,
  onChangeUserId,
  onSubmit,
}: StartDirectChatProps) {
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 backdrop-blur-2xs p-0 sm:items-center sm:p-4">
      <div
        className="max-h-[92dvh] w-full max-w-[95vw] overflow-y-auto rounded-t-xl sm:rounded-xl border border-[var(--border)] bg-[var(--surface-strong,#ffffff)] p-4 sm:p-5 sm:max-w-md shadow-xl"
      >
        <h3 className="text-base font-bold text-[var(--text-main)]">Start 1:1 Conversation</h3>
        <p className="mt-0.5 text-xs text-[var(--text-soft)]">Direct, private communication with a team member.</p>
        <div className="mt-3.5">
          <ResponsiveSelect
            value={selectedUserId}
            onChange={onChangeUserId}
            ariaLabel="Select colleague"
            placeholder="Select colleague..."
            options={users.map((member) => ({
              value: member.id,
              label: `${member.name} (${member.role})`,
            }))}
            buttonClassName="h-9 text-xs rounded-md"
          />
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-[var(--border)] px-3 py-1.5 text-xs font-semibold text-[var(--text-soft)] hover:bg-[var(--surface-soft)] transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={saving || !selectedUserId}
            onClick={onSubmit}
            className="rounded-md bg-[var(--accent)] hover:bg-[var(--accent-strong)] px-3.5 py-1.5 text-xs font-semibold text-white transition-colors disabled:opacity-50"
          >
            {saving ? "Opening..." : "Open Chat"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Group Settings Drawer ──────────────────────────────── */

type GroupSettingsProps = {
  activeGroup: ChatGroup;
  members: ChatGroupMember[];
  allUsers: CRMUser[];
  saving: boolean;
  onClose: () => void;
  onChangeName: (v: string) => void;
  onChangeDesc: (v: string) => void;
  onSave: () => void;
  onRemoveMember: (userId: string) => void;
  onAddMember: (userId: string) => void;
  onDelete: () => void;
};

export function GroupSettingsDrawer({
  activeGroup,
  members,
  allUsers,
  saving,
  onClose,
  onChangeName,
  onChangeDesc,
  onSave,
  onRemoveMember,
  onAddMember,
  onDelete,
}: GroupSettingsProps) {
  const nonMembers = allUsers.filter((u) => !members.some((m) => m.userId === u.id));

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-end bg-black/40 backdrop-blur-2xs sm:items-stretch">
      <div
        className="h-[min(92dvh,100%)] w-full max-w-md overflow-y-auto rounded-t-xl sm:rounded-none border-t sm:border-t-0 sm:border-l border-[var(--border)] bg-[var(--surface-strong,#ffffff)] p-4 sm:p-5 shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
          <h3 className="text-base font-bold text-[var(--text-main)]">Channel Details</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-[var(--border)] px-2 py-1 text-xs text-[var(--text-soft)] hover:bg-[var(--surface-soft)]"
          >
            Close
          </button>
        </div>

        <div className="mt-3.5 space-y-2">
          <label className="block text-xs font-semibold text-[var(--text-main)]">Channel Name</label>
          <input
            value={activeGroup.name}
            onChange={(e) => onChangeName(e.target.value)}
            className="w-full rounded-md border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2 text-xs text-[var(--text-main)] outline-none focus:border-[var(--accent)]"
          />
        </div>

        <div className="mt-3 space-y-1">
          <label className="block text-xs font-semibold text-[var(--text-main)]">Description</label>
          <textarea
            value={activeGroup.description || ""}
            onChange={(e) => onChangeDesc(e.target.value)}
            className="min-h-16 w-full rounded-md border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2 text-xs text-[var(--text-main)] outline-none focus:border-[var(--accent)]"
          />
        </div>

        <button
          type="button"
          disabled={saving}
          onClick={onSave}
          className="mt-3 w-full rounded-md bg-[var(--accent)] hover:bg-[var(--accent-strong)] px-3 py-2 text-xs font-semibold text-white transition-colors disabled:opacity-50"
        >
          {saving ? "Saving Changes..." : "Save Channel Details"}
        </button>

        <div className="mt-5 border-t border-[var(--border)] pt-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-wider text-[var(--text-main)]">
              Members ({members.length})
            </p>
          </div>

          <div className="mt-2 space-y-1.5 max-h-48 overflow-y-auto pr-1">
            {members.map((member) => (
              <div
                key={member.id}
                className="flex items-center justify-between rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] px-2.5 py-1.5 text-xs"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <UserAvatar
                    name={member.user.name}
                    avatarUrl={member.user.avatarUrl}
                    authProvider={member.user.authProvider}
                    className="h-6 w-6 shrink-0 rounded-full text-[9px]"
                  />
                  <span className="truncate text-[var(--text-main)] font-medium">
                    {member.user.name}{" "}
                    <span className="text-[10px] text-[var(--text-faint)]">({member.user.role})</span>
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => onRemoveMember(member.userId)}
                  className="text-xs text-rose-600 hover:text-rose-700 font-medium"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>

          {nonMembers.length > 0 && (
            <div className="mt-3">
              <p className="text-[11px] font-semibold text-[var(--text-soft)] mb-1.5">Add Colleague to Channel</p>
              <div className="max-h-40 overflow-y-auto rounded-md border border-[var(--border)] bg-[var(--surface)] p-1.5 space-y-1">
                {nonMembers.map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => onAddMember(u.id)}
                    className="flex w-full items-center gap-2 rounded px-2 py-1 text-left text-xs hover:bg-[var(--surface-soft)] text-[var(--text-main)]"
                  >
                    <UserAvatar
                      name={u.name}
                      avatarUrl={u.avatarUrl}
                      authProvider={u.authProvider}
                      className="h-5 w-5 shrink-0 rounded-full text-[9px]"
                    />
                    <span className="truncate">
                      Add {u.name} <span className="text-[10px] text-[var(--text-faint)]">({u.role})</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="mt-6 border-t border-[var(--border)] pt-4">
          <button
            type="button"
            onClick={onDelete}
            className="w-full rounded-md border border-rose-200 dark:border-rose-900/50 px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
          >
            Delete Channel
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Media Panel Drawer ─────────────────────────────────── */

type MediaPanelProps = {
  room: ChatRoom;
  user: CRMUser;
  mediaFilter: ChatMediaTypeFilter;
  mediaItems: ChatMessage[];
  mediaLoading: boolean;
  mediaDeletingId: string | null;
  selectedMediaIds: string[];
  bulkDeleting: boolean;
  onClose: () => void;
  onChangeFilter: (f: ChatMediaTypeFilter) => void;
  onToggleSelect: (id: string) => void;
  onDeleteOne: (id: string) => void;
  onDeleteSelected: () => void;
};

export function MediaPanelDrawer({
  room,
  user,
  mediaFilter,
  mediaItems,
  mediaLoading,
  mediaDeletingId,
  selectedMediaIds,
  bulkDeleting,
  onClose,
  onChangeFilter,
  onToggleSelect,
  onDeleteOne,
  onDeleteSelected,
}: MediaPanelProps) {
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-end bg-black/40 backdrop-blur-2xs sm:items-stretch">
      <div
        className="h-[min(92dvh,100%)] w-full max-w-md overflow-y-auto rounded-t-xl sm:rounded-none border-t sm:border-t-0 sm:border-l border-[var(--border)] bg-[var(--surface-strong,#ffffff)] p-4 sm:p-5 shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
          <div>
            <h3 className="text-base font-bold text-[var(--text-main)]">Files & Media</h3>
            <p className="text-xs text-[var(--text-soft)] truncate max-w-[280px]">{room.name}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-[var(--border)] px-2 py-1 text-xs text-[var(--text-soft)] hover:bg-[var(--surface-soft)]"
          >
            Close
          </button>
        </div>

        {/* Media Filter Tabs */}
        <div className="mt-3 flex gap-1.5 border-b border-[var(--border)] pb-2.5">
          {(["ALL", "IMAGE", "PDF"] as ChatMediaTypeFilter[]).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => onChangeFilter(f)}
              className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-colors ${
                mediaFilter === f
                  ? "bg-[var(--accent)] text-white"
                  : "text-[var(--text-soft)] hover:bg-[var(--surface-soft)]"
              }`}
            >
              {f === "ALL" ? "All" : f === "IMAGE" ? "Images" : "Documents"}
            </button>
          ))}
        </div>

        <div className="mt-2.5 flex items-center justify-between">
          <p className="text-xs text-[var(--text-soft)]">{selectedMediaIds.length} selected</p>
          <button
            type="button"
            onClick={onDeleteSelected}
            disabled={!selectedMediaIds.length || bulkDeleting}
            className="rounded-md border border-rose-200 dark:border-rose-900/50 px-2.5 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 disabled:opacity-50 transition-colors"
          >
            {bulkDeleting ? "Deleting..." : "Delete Selected"}
          </button>
        </div>

        <div className="mt-3.5 space-y-2.5">
          {mediaLoading && (
            <p className="text-xs text-[var(--text-soft)]">Loading media...</p>
          )}
          {!mediaLoading && !mediaItems.length && (
            <p className="rounded-lg border border-dashed border-[var(--border)] p-4 text-center text-xs text-[var(--text-soft)]">
              No files or media in this channel.
            </p>
          )}
          {mediaItems.map((item) => {
            const canDel =
              item.author.id === user.id ||
              user.role === "ADMIN" ||
              user.role === "SUPERADMIN";
            return (
              <div
                key={item.id}
                className="rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] p-2.5 transition-colors"
              >
                <div className="mb-2 flex items-center justify-between text-xs text-[var(--text-soft)]">
                  <label className="flex cursor-pointer items-center gap-1.5">
                    <input
                      type="checkbox"
                      checked={selectedMediaIds.includes(item.id)}
                      onChange={() => onToggleSelect(item.id)}
                      className="rounded"
                    />
                    <span className="font-medium text-[var(--text-main)]">{item.author.name}</span>
                  </label>
                  <span>{formatTime(item.createdAt)}</span>
                </div>

                {item.messageType === "PDF" ? (
                  <a
                    href={resolveAttachmentUrl(item.attachmentUrl)}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-2 rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs font-medium text-[var(--text-main)] hover:border-[var(--accent)]"
                  >
                    <span>📄</span>
                    <span className="truncate">{item.attachmentFileName || "Open Document"}</span>
                  </a>
                ) : (
                  <img
                    src={resolveAttachmentUrl(item.attachmentUrl)}
                    alt={item.attachmentFileName || "Attachment"}
                    className="max-h-48 w-full rounded-md border border-[var(--border)] object-cover bg-[var(--surface)]"
                  />
                )}

                <div className="mt-2 flex gap-2 justify-end">
                  <a
                    href={resolveAttachmentUrl(item.attachmentUrl)}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-md border border-[var(--border)] px-2.5 py-1 text-xs font-medium text-[var(--text-main)] hover:bg-[var(--surface)]"
                  >
                    Open
                  </a>
                  {canDel && (
                    <button
                      type="button"
                      onClick={() => onDeleteOne(item.id)}
                      disabled={mediaDeletingId === item.id}
                      className="rounded-md border border-rose-200 dark:border-rose-900/50 px-2.5 py-1 text-xs font-medium text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 disabled:opacity-50"
                    >
                      {mediaDeletingId === item.id ? "Deleting..." : "Delete"}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
