"use client";

import type { ChatRoom, ChatRoomsResponse } from "@/types/crm";
import { roomKey } from "./chat-utils";

type Props = {
  rooms: ChatRoomsResponse;
  selectedKey: string;
  loading: boolean;
  onSelect: (key: string) => void;
};

function RoomButton({
  room,
  active,
  onSelect,
}: {
  room: ChatRoom;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="w-full rounded-2xl border px-4 py-3 text-left transition"
      style={{
        borderColor: active ? "var(--accent)" : "var(--border)",
        background: active
          ? "color-mix(in srgb, var(--accent) 10%, var(--surface))"
          : "var(--surface-soft)",
      }}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-[var(--text-main)]">{room.name}</p>
        {!!room.unreadCount && (
          <span className="rounded-full bg-[var(--accent)] px-2 py-0.5 text-[10px] font-semibold text-white">
            {room.unreadCount}
          </span>
        )}
      </div>
      <p className="mt-1 truncate text-xs text-[var(--text-soft)]">
        {room.lastMessagePreview || room.subtitle}
      </p>
    </button>
  );
}

function EmptyRoom({ label }: { label: string }) {
  return (
    <p
      className="rounded-2xl border px-4 py-3 text-sm text-[var(--text-soft)]"
      style={{ borderColor: "var(--border)" }}
    >
      {label}
    </p>
  );
}

export function ChatRoomList({ rooms, selectedKey, loading, onSelect }: Props) {
  const directRooms = rooms.groups.filter((room) => room.isDirect);
  const groupRooms = rooms.groups.filter((room) => !room.isDirect);

  return (
    <div className="space-y-5">
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-faint)]">
          Departments
        </p>
        <div className="space-y-2">
          {rooms.departments.map((room) => (
            <RoomButton
              key={roomKey(room)}
              room={room}
              active={roomKey(room) === selectedKey}
              onSelect={() => onSelect(roomKey(room))}
            />
          ))}
          {!loading && !rooms.departments.length && (
            <EmptyRoom label="No department room available." />
          )}
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-faint)]">
          One-to-one
        </p>
        <div className="space-y-2">
          {directRooms.map((room) => (
            <RoomButton
              key={roomKey(room)}
              room={room}
              active={roomKey(room) === selectedKey}
              onSelect={() => onSelect(roomKey(room))}
            />
          ))}
          {!loading && !directRooms.length && (
            <EmptyRoom label="No one-to-one room available." />
          )}
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-faint)]">
          Groups
        </p>
        <div className="space-y-2">
          {groupRooms.map((room) => (
            <RoomButton
              key={roomKey(room)}
              room={room}
              active={roomKey(room) === selectedKey}
              onSelect={() => onSelect(roomKey(room))}
            />
          ))}
          {!loading && !groupRooms.length && (
            <EmptyRoom label="No group room available." />
          )}
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-faint)]">
          Projects
        </p>
        <div className="space-y-2">
          {rooms.projects.map((room) => (
            <RoomButton
              key={roomKey(room)}
              room={room}
              active={roomKey(room) === selectedKey}
              onSelect={() => onSelect(roomKey(room))}
            />
          ))}
          {!loading && !rooms.projects.length && (
            <EmptyRoom label="No project room available." />
          )}
        </div>
      </div>
    </div>
  );
}
