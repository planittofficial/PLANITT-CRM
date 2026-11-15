"use client";

import { UserAvatar } from "@/components/shared/user-avatar";
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
      className={`group relative flex w-full items-center gap-2.5 rounded-lg border px-3 py-2 text-left transition-colors ${
        active
          ? "border-[var(--accent)]/30 bg-[var(--surface-soft)] shadow-2xs"
          : "border-transparent hover:bg-[var(--surface-soft)]"
      }`}
    >
      {active && (
        <span
          className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-1 rounded-r bg-[var(--accent)]"
          aria-hidden
        />
      )}

      {room.isDirect && room.directPeer ? (
        <UserAvatar
          name={room.directPeer.name}
          avatarUrl={room.directPeer.avatarUrl}
          authProvider={room.directPeer.authProvider}
          className="h-8 w-8 shrink-0 rounded-full text-[10px]"
        />
      ) : (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--surface)] border border-[var(--border)] text-xs font-bold text-[var(--accent)]">
          #
        </div>
      )}

      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-1.5">
          <p
            className={`truncate text-xs ${
              active
                ? "font-semibold text-[var(--text-main)]"
                : "font-medium text-[var(--text-main)]"
            }`}
          >
            {room.name}
          </p>
          {!!room.unreadCount && (
            <span className="rounded-full bg-[var(--accent)] px-1.5 py-0.2 text-[10px] font-bold text-white">
              {room.unreadCount}
            </span>
          )}
        </div>
        <p className="mt-0.5 truncate text-[11px] text-[var(--text-soft)]">
          {room.lastMessagePreview || room.subtitle || "No messages yet"}
        </p>
      </div>
    </button>
  );
}

function EmptyRoom({ label }: { label: string }) {
  return (
    <p className="rounded-lg border border-dashed border-[var(--border)] px-3 py-2 text-center text-xs text-[var(--text-soft)]">
      {label}
    </p>
  );
}

export function ChatRoomList({ rooms, selectedKey, loading, onSelect }: Props) {
  const directRooms = rooms.groups.filter((room) => room.isDirect);
  const groupRooms = rooms.groups.filter((room) => !room.isDirect);

  return (
    <div className="space-y-4">
      <div>
        <p className="mb-1.5 px-1 text-[11px] font-bold uppercase tracking-wider text-[var(--text-soft)]">
          Departments
        </p>
        <div className="space-y-1">
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
        <p className="mb-1.5 px-1 text-[11px] font-bold uppercase tracking-wider text-[var(--text-soft)]">
          Direct Messages
        </p>
        <div className="space-y-1">
          {directRooms.map((room) => (
            <RoomButton
              key={roomKey(room)}
              room={room}
              active={roomKey(room) === selectedKey}
              onSelect={() => onSelect(roomKey(room))}
            />
          ))}
          {!loading && !directRooms.length && (
            <EmptyRoom label="No direct chats yet." />
          )}
        </div>
      </div>

      <div>
        <p className="mb-1.5 px-1 text-[11px] font-bold uppercase tracking-wider text-[var(--text-soft)]">
          Channels & Groups
        </p>
        <div className="space-y-1">
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
        <p className="mb-1.5 px-1 text-[11px] font-bold uppercase tracking-wider text-[var(--text-soft)]">
          Projects
        </p>
        <div className="space-y-1">
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
