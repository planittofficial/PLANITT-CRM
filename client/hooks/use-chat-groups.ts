"use client";

import { useState } from "react";
import { apiDelete, apiGet, apiPost, apiPut } from "@/lib/api";
import { normalizeErrorMessage } from "@/lib/error-message";
import type { ChatGroup, ChatGroupMember, ChatRoom } from "@/types/crm";

export function useChatGroups(onError: (msg: string) => void, onRefreshRooms: () => Promise<void>) {
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [groupDescription, setGroupDescription] = useState("");
  const [groupMemberIds, setGroupMemberIds] = useState<string[]>([]);
  const [groupSaving, setGroupSaving] = useState(false);
  const [showGroupSettings, setShowGroupSettings] = useState(false);
  const [activeGroup, setActiveGroup] = useState<ChatGroup | null>(null);
  const [activeGroupMembers, setActiveGroupMembers] = useState<ChatGroupMember[]>([]);

  const createGroup = async () => {
    if (!groupName.trim()) return;
    try {
      setGroupSaving(true);
      await apiPost<ChatGroup>("/chat/groups", {
        name: groupName,
        description: groupDescription,
        memberIds: groupMemberIds,
      });
      setShowCreateGroup(false);
      setGroupName("");
      setGroupDescription("");
      setGroupMemberIds([]);
      await onRefreshRooms();
    } catch (err) {
      onError(normalizeErrorMessage(err, "Failed to create group"));
    } finally {
      setGroupSaving(false);
    }
  };

  const startDirectChat = async (targetUserId: string) => {
    if (!targetUserId) return;
    try {
      setGroupSaving(true);
      await apiPost<ChatGroup>("/chat/direct", { targetUserId });
      await onRefreshRooms();
    } catch (err) {
      onError(normalizeErrorMessage(err, "Failed to start one-to-one chat"));
    } finally {
      setGroupSaving(false);
    }
  };

  const openGroupSettings = async (room: ChatRoom) => {
    if (room.type !== "GROUP") return;
    try {
      const [group, members] = await Promise.all([
        apiGet<ChatGroup>(`/chat/groups/${room.id}`),
        apiGet<ChatGroupMember[]>(`/chat/groups/${room.id}/members`),
      ]);
      setActiveGroup(group);
      setActiveGroupMembers(members);
      setShowGroupSettings(true);
    } catch (err) {
      onError(normalizeErrorMessage(err, "Failed to load group settings"));
    }
  };

  const updateGroup = async () => {
    if (!activeGroup) return;
    try {
      setGroupSaving(true);
      const updated = await apiPut<ChatGroup>(`/chat/groups/${activeGroup.id}`, {
        name: activeGroup.name,
        description: activeGroup.description || "",
      });
      setActiveGroup(updated);
      await onRefreshRooms();
    } catch (err) {
      onError(normalizeErrorMessage(err, "Failed to update group"));
    } finally {
      setGroupSaving(false);
    }
  };

  const addMembers = async (memberIds: string[]) => {
    if (!activeGroup || !memberIds.length) return;
    try {
      const members = await apiPost<ChatGroupMember[]>(
        `/chat/groups/${activeGroup.id}/members`,
        { memberIds },
      );
      setActiveGroupMembers(members);
      await onRefreshRooms();
    } catch (err) {
      onError(normalizeErrorMessage(err, "Failed to add members"));
    }
  };

  const removeMember = async (memberId: string) => {
    if (!activeGroup) return;
    try {
      await apiDelete<{ success: boolean }>(
        `/chat/groups/${activeGroup.id}/members/${memberId}`,
      );
      setActiveGroupMembers((c) => c.filter((x) => x.userId !== memberId));
      await onRefreshRooms();
    } catch (err) {
      onError(normalizeErrorMessage(err, "Failed to remove member"));
    }
  };

  const deleteGroup = async (onSelectKey: (key: string) => void) => {
    if (!activeGroup) return;
    try {
      await apiDelete<void>(`/chat/groups/${activeGroup.id}`);
      setShowGroupSettings(false);
      setActiveGroup(null);
      setActiveGroupMembers([]);
      await onRefreshRooms();
      onSelectKey("");
    } catch (err) {
      onError(normalizeErrorMessage(err, "Failed to delete group"));
    }
  };

  return {
    showCreateGroup,
    groupName,
    groupDescription,
    groupMemberIds,
    groupSaving,
    showGroupSettings,
    activeGroup,
    activeGroupMembers,
    setShowCreateGroup,
    setGroupName,
    setGroupDescription,
    setGroupMemberIds,
    setShowGroupSettings,
    setActiveGroup,
    createGroup,
    startDirectChat,
    openGroupSettings,
    updateGroup,
    addMembers,
    removeMember,
    deleteGroup,
  };
}
