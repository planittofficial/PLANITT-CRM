"use client";

import { createContext, useContext, useEffect, useState, useCallback, useMemo } from "react";
import { useSocket } from "./socket-provider";
import { apiGet, apiPut, apiPost } from "@/lib/api";
import type { UserPresence, UserPresenceStatus } from "@/types/crm";

type PresenceContextType = {
  presences: Record<string, UserPresence>;
  getUserPresence: (userId: string) => UserPresence | undefined;
  updateStatus: (status: UserPresenceStatus, customStatusMessage?: string | null) => Promise<void>;
  setMeetingStatus: (meetingTitle: string, durationMinutes?: number) => Promise<void>;
  clearMeetingStatus: () => Promise<void>;
  refreshPresences: () => Promise<void>;
};

const PresenceContext = createContext<PresenceContextType>({
  presences: {},
  getUserPresence: () => undefined,
  updateStatus: async () => {},
  setMeetingStatus: async () => {},
  clearMeetingStatus: async () => {},
  refreshPresences: async () => {},
});

export function PresenceProvider({ children }: { children: React.ReactNode }) {
  const { socket, connected } = useSocket();
  const [presences, setPresences] = useState<Record<string, UserPresence>>({});

  const refreshPresences = useCallback(async () => {
    try {
      const data = await apiGet<UserPresence[]>("/users/presence");
      if (Array.isArray(data)) {
        const map: Record<string, UserPresence> = {};
        data.forEach((p) => {
          if (p.userId) map[p.userId] = p;
        });
        setPresences((prev) => ({ ...prev, ...map }));
      }
    } catch {
      // Ignore if unauthenticated
    }
  }, []);

  useEffect(() => {
    void refreshPresences();
  }, [refreshPresences]);

  useEffect(() => {
    if (!socket) return;

    const handleBatch = (batch: UserPresence[]) => {
      if (!Array.isArray(batch)) return;
      setPresences((prev) => {
        const next = { ...prev };
        batch.forEach((item) => {
          if (item?.userId) {
            next[item.userId] = {
              ...(next[item.userId] || {}),
              ...item,
            };
          }
        });
        return next;
      });
    };

    const handleUpdate = (update: UserPresence) => {
      if (!update?.userId) return;
      setPresences((prev) => ({
        ...prev,
        [update.userId]: {
          ...(prev[update.userId] || {}),
          ...update,
        },
      }));
    };

    socket.on("presence:batch", handleBatch);
    socket.on("presence:update", handleUpdate);

    if (connected) {
      socket.emit("presence:get_batch");
    }

    return () => {
      socket.off("presence:batch", handleBatch);
      socket.off("presence:update", handleUpdate);
    };
  }, [socket, connected]);

  const getUserPresence = useCallback(
    (userId: string) => {
      return presences[userId];
    },
    [presences]
  );

  const updateStatus = useCallback(
    async (status: UserPresenceStatus, customStatusMessage?: string | null) => {
      try {
        if (socket?.connected) {
          socket.emit("presence:set", { status, customStatusMessage });
        }
        await apiPut("/users/me/presence", {
          status,
          customStatusMessage,
        });
      } catch (err) {
        console.error("Failed to update status:", err);
      }
    },
    [socket]
  );

  const setMeetingStatus = useCallback(
    async (meetingTitle: string, durationMinutes = 45) => {
      try {
        if (socket?.connected) {
          socket.emit("presence:meeting_started", { meetingTitle, durationMinutes });
        }
        await apiPost("/users/me/meeting-started", {
          meetingTitle,
          durationMinutes,
        });
      } catch (err) {
        console.error("Failed to set meeting status:", err);
      }
    },
    [socket]
  );

  const clearMeetingStatus = useCallback(async () => {
    try {
      if (socket?.connected) {
        socket.emit("presence:meeting_ended");
      }
      await apiPost("/users/me/meeting-ended");
    } catch (err) {
      console.error("Failed to clear meeting status:", err);
    }
  }, [socket]);

  const value = useMemo(
    () => ({
      presences,
      getUserPresence,
      updateStatus,
      setMeetingStatus,
      clearMeetingStatus,
      refreshPresences,
    }),
    [presences, getUserPresence, updateStatus, setMeetingStatus, clearMeetingStatus, refreshPresences]
  );

  return <PresenceContext.Provider value={value}>{children}</PresenceContext.Provider>;
}

export function usePresence() {
  return useContext(PresenceContext);
}
