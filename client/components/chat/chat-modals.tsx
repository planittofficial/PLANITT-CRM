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
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/35 p-4">
      <div
        className="w-full max-w-xl rounded-2xl border p-4"
        style={{ background: "var(--surface)", borderColor: "var(--border)" }}
      >
        <h3 className="text-lg font-semibold text-[var(--text-main)]">Create group</h3>
        <input
          value={groupName}
          onChange={(e) => onChangeName(e.target.value)}
          placeholder="Group name"
          className="mt-3 w-full rounded-xl border px-3 py-2 text-sm outline-none"
          style={{ borderColor: "var(--border)", background: "var(--surface-soft)", color: "var(--text-main)" }}
        />
        <input
          value={groupDescription}
          onChange={(e) => onChangeDesc(e.target.value)}
          placeholder="Description (optional)"
          className="mt-2 w-full rounded-xl border px-3 py-2 text-sm outline-none"
          style={{ borderColor: "var(--border)", background: "var(--surface-soft)", color: "var(--text-main)" }}
        />
        <div
          className="mt-3 max-h-48 overflow-y-auto rounded-xl border p-2"
          style={{ borderColor: "var(--border)" }}
        >
          {users.map((member) => (
            <label key={member.id} className="flex items-center gap-3 px-2 py-1 text-sm">
              <input
                type="checkbox"
                checked={groupMemberIds.includes(member.id)}
                onChange={(e) => onToggleMember(member.id, e.target.checked)}
              />
              <UserAvatar
                name={member.name}
                avatarUrl={member.avatarUrl}
                authProvider={member.authProvider}
                className="h-7 w-7 shrink-0 rounded-full text-[9px]"
              />
              <span className="min-w-0">
                <span className="block truncate">{member.name}</span>
                <span className="block text-xs text-[var(--text-faint)]">{member.role}</span>
              </span>
            </label>
          ))}
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border px-3 py-2 text-sm"
            style={{ borderColor: "var(--border)", color: "var(--text-main)" }}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={saving || !groupName.trim()}
            onClick={onSubmit}
            className="rounded-lg px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
            style={{ background: "var(--accent)" }}
          >
            {saving ? "Creating..." : "Create"}
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
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/35 p-4">
      <div
        className="w-full max-w-xl rounded-2xl border p-4"
        style={{ background: "var(--surface)", borderColor: "var(--border)" }}
      >
        <h3 className="text-lg font-semibold text-[var(--text-main)]">Start one-to-one chat</h3>
        <p className="mt-1 text-sm text-[var(--text-soft)]">Select a member to open a private chat room.</p>
        <select
          value={selectedUserId}
          onChange={(e) => onChangeUserId(e.target.value)}
          className="mt-3 h-11 w-full rounded-xl border px-3 text-sm outline-none"
          style={{ borderColor: "var(--border)", background: "var(--surface-soft)", color: "var(--text-main)" }}
        >
          <option value="">Select member</option>
          {users.map((member) => (
            <option key={member.id} value={member.id}>
              {member.name} ({member.role})
            </option>
          ))}
        </select>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border px-3 py-2 text-sm"
            style={{ borderColor: "var(--border)", color: "var(--text-main)" }}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={saving || !selectedUserId}
            onClick={onSubmit}
            className="rounded-lg px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
            style={{ background: "var(--accent)" }}
          >
            {saving ? "Opening..." : "Open chat"}
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
    <div className="fixed inset-0 z-40 flex justify-end bg-black/30">
      <div
        className="h-full w-full max-w-md overflow-y-auto border-l p-4"
        style={{ background: "var(--surface)", borderColor: "var(--border)" }}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-[var(--text-main)]">Group settings</h3>
          <button type="button" onClick={onClose} className="text-sm text-[var(--text-soft)]">
            Close
          </button>
        </div>
        <input
          value={activeGroup.name}
          onChange={(e) => onChangeName(e.target.value)}
          className="mt-3 w-full rounded-xl border px-3 py-2 text-sm outline-none"
          style={{ borderColor: "var(--border)", background: "var(--surface-soft)", color: "var(--text-main)" }}
        />
        <textarea
          value={activeGroup.description || ""}
          onChange={(e) => onChangeDesc(e.target.value)}
          className="mt-2 min-h-20 w-full rounded-xl border px-3 py-2 text-sm outline-none"
          style={{ borderColor: "var(--border)", background: "var(--surface-soft)", color: "var(--text-main)" }}
        />
        <button
          type="button"
          disabled={saving}
          onClick={onSave}
          className="mt-2 rounded-lg px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
          style={{ background: "var(--accent)" }}
        >
          Save group
        </button>
        <div className="mt-4">
          <p className="text-sm font-semibold text-[var(--text-main)]">Members</p>
          <div className="mt-2 space-y-2">
            {members.map((member) => (
              <div
                key={member.id}
                className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm"
                style={{ borderColor: "var(--border)" }}
              >
                <div className="flex min-w-0 items-center gap-2">
                  <UserAvatar
                    name={member.user.name}
                    avatarUrl={member.user.avatarUrl}
                    authProvider={member.user.authProvider}
                    className="h-7 w-7 shrink-0 rounded-full text-[9px]"
                  />
                  <span className="truncate">
                    {member.user.name} ({member.user.role})
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => onRemoveMember(member.userId)}
                  className="text-red-600"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
          {nonMembers.length > 0 && (
            <div
              className="mt-3 max-h-44 overflow-y-auto rounded-xl border p-2"
              style={{ borderColor: "var(--border)" }}
            >
              {nonMembers.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => onAddMember(u.id)}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-1 text-left text-sm hover:bg-[var(--surface-soft)]"
                  style={{ color: "var(--text-main)" }}
                >
                  <UserAvatar
                    name={u.name}
                    avatarUrl={u.avatarUrl}
                    authProvider={u.authProvider}
                    className="h-7 w-7 shrink-0 rounded-full text-[9px]"
                  />
                  <span className="truncate">
                    Add {u.name} ({u.role})
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={onDelete}
          className="mt-6 rounded-lg border px-3 py-2 text-sm text-red-600"
          style={{ borderColor: "color-mix(in srgb, red 30%, var(--border))" }}
        >
          Delete group
        </button>
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
    <div className="fixed inset-0 z-40 flex justify-end bg-black/30">
      <div
        className="h-full w-full max-w-md overflow-y-auto border-l p-4"
        style={{ background: "var(--surface)", borderColor: "var(--border)" }}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-[var(--text-main)]">Media</h3>
          <button type="button" onClick={onClose} className="text-sm text-[var(--text-soft)]">
            Close
          </button>
        </div>
        <p className="mt-1 text-sm text-[var(--text-soft)]">{room.name}</p>
        <div className="mt-3 flex gap-2">
          {(["ALL", "IMAGE", "PDF"] as ChatMediaTypeFilter[]).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => onChangeFilter(f)}
              className="rounded-full border px-3 py-1 text-xs font-semibold"
              style={{
                borderColor: mediaFilter === f ? "var(--accent)" : "var(--border)",
                color: mediaFilter === f ? "var(--accent)" : "var(--text-main)",
              }}
            >
              {f === "ALL" ? "All" : f === "IMAGE" ? "Images" : "PDFs"}
            </button>
          ))}
        </div>
        <div className="mt-3 flex items-center justify-between">
          <p className="text-xs text-[var(--text-soft)]">{selectedMediaIds.length} selected</p>
          <button
            type="button"
            onClick={onDeleteSelected}
            disabled={!selectedMediaIds.length || bulkDeleting}
            className="rounded-lg border px-3 py-1 text-xs font-semibold text-red-600 disabled:opacity-60"
            style={{ borderColor: "color-mix(in srgb, red 30%, var(--border))" }}
          >
            {bulkDeleting ? "Deleting..." : "Delete selected"}
          </button>
        </div>
        <div className="mt-4 space-y-3">
          {mediaLoading && (
            <p className="text-sm text-[var(--text-soft)]">Loading media...</p>
          )}
          {!mediaLoading && !mediaItems.length && (
            <p
              className="rounded-xl border px-3 py-2 text-sm text-[var(--text-soft)]"
              style={{ borderColor: "var(--border)" }}
            >
              No media found in this chat.
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
                className="rounded-xl border p-3"
                style={{ borderColor: "var(--border)" }}
              >
                <label className="mb-2 flex cursor-pointer items-center gap-2 text-xs text-[var(--text-soft)]">
                  <input
                    type="checkbox"
                    checked={selectedMediaIds.includes(item.id)}
                    onChange={() => onToggleSelect(item.id)}
                  />
                  Select
                </label>
                <div className="mb-2 flex items-center justify-between text-xs text-[var(--text-soft)]">
                  <span>{item.author.name}</span>
                  <span>{formatTime(item.createdAt)}</span>
                </div>
                {item.messageType === "PDF" ? (
                  <a
                    href={resolveAttachmentUrl(item.attachmentUrl)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex rounded-lg border px-3 py-2 text-sm font-medium text-[var(--text-main)]"
                    style={{ borderColor: "var(--border)", background: "var(--surface-soft)" }}
                  >
                    {item.attachmentFileName || "Open PDF"}
                  </a>
                ) : (
                  <img
                    src={resolveAttachmentUrl(item.attachmentUrl)}
                    alt={item.attachmentFileName || "Attachment"}
                    className="max-h-52 w-full rounded-lg border object-cover"
                    style={{ borderColor: "var(--border)", background: "var(--surface-soft)" }}
                  />
                )}
                <div className="mt-2 flex gap-2">
                  <a
                    href={resolveAttachmentUrl(item.attachmentUrl)}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-lg border px-2 py-1 text-xs font-semibold"
                    style={{ borderColor: "var(--border)", color: "var(--text-main)" }}
                  >
                    Open
                  </a>
                  {canDel && (
                    <button
                      type="button"
                      onClick={() => onDeleteOne(item.id)}
                      disabled={mediaDeletingId === item.id}
                      className="rounded-lg border px-2 py-1 text-xs font-semibold text-red-600 disabled:opacity-60"
                      style={{ borderColor: "color-mix(in srgb, red 30%, var(--border))" }}
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
