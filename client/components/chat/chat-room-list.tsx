"use client";

import { UserAvatar } from "@/components/shared/user-avatar";
import { HashIcon, UsersIcon, FolderKanbanIcon } from "@/components/ui/icons";
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
      className={`group relative flex w-full items-center gap-3 rounded-xl border p-2.5 text-left transition-all min-h-[48px] active:scale-[0.99] ${
        active
          ? "border-[var(--accent)]/40 bg-[var(--accent)]/10 shadow-xs"
          : "border-transparent hover:bg-[var(--surface-soft)] hover:border-[var(--border)]"
      }`}
    >
      {active && (
        <span
          className="absolute left-0 top-1/2 -translate-y-1/2 h-6 w-1 rounded-r-full bg-[var(--accent)]"
          aria-hidden
        />
      )}

      {room.isDirect && room.directPeer ? (
        <UserAvatar
          name={room.directPeer.name}
          avatarUrl={room.directPeer.avatarUrl}
          authProvider={room.directPeer.authProvider}
          className="h-9 w-9 shrink-0 rounded-full text-xs shadow-2xs"
        />
      ) : room.type === "DEPARTMENT" ? (
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-50 border border-indigo-200/60 text-xs font-bold text-[var(--accent)] dark:bg-indigo-950/50 dark:border-indigo-800">
          <UsersIcon size={16} />
        </div>
      ) : room.type === "PROJECT" ? (
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-purple-50 border border-purple-200/60 text-xs font-bold text-purple-600 dark:bg-purple-950/50 dark:border-purple-800">
          <FolderKanbanIcon size={16} />
        </div>
      ) : (
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--surface-soft)] border border-[var(--border)] text-xs font-bold text-[var(--text-soft)]">
          <HashIcon size={16} />
        </div>
      )}

      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-1.5">
          <p
            className={`truncate text-xs ${
              active
                ? "font-bold text-[var(--text-main)]"
                : "font-semibold text-[var(--text-main)]"
            }`}
          >
            {room.name}
          </p>
          {!!room.unreadCount && (
            <span className="rounded-full bg-[var(--accent)] px-2 py-0.5 text-[10px] font-black text-white shadow-2xs">
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

function SectionHeading({ title, count }: { title: string; count?: number }) {
  return (
    <div className="flex items-center justify-between px-1 mb-1.5">
      <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-faint)]">
        {title}
      </span>
      {typeof count === "number" && count > 0 && (
        <span className="text-[10px] font-semibold text-[var(--text-faint)]">
          {count}
        </span>
      )}
    </div>
  );
}

export function ChatRoomList({ rooms, selectedKey, loading, onSelect }: Props) {
  const directRooms = rooms.groups.filter((room) => room.isDirect);
  const groupRooms = rooms.groups.filter((room) => !room.isDirect);

  return (
    <div className="space-y-4">
      {rooms.departments.length > 0 && (
        <div>
          <SectionHeading title="Departments" count={rooms.departments.length} />
          <div className="space-y-1">
            {rooms.departments.map((room) => (
              <RoomButton
                key={roomKey(room)}
                room={room}
                active={roomKey(room) === selectedKey}
                onSelect={() => onSelect(roomKey(room))}
              />
            ))}
          </div>
        </div>
      )}

      {directRooms.length > 0 && (
        <div>
          <SectionHeading title="Direct Messages" count={directRooms.length} />
          <div className="space-y-1">
            {directRooms.map((room) => (
              <RoomButton
                key={roomKey(room)}
                room={room}
                active={roomKey(room) === selectedKey}
                onSelect={() => onSelect(roomKey(room))}
              />
            ))}
          </div>
        </div>
      )}

      {groupRooms.length > 0 && (
        <div>
          <SectionHeading title="Channels & Groups" count={groupRooms.length} />
          <div className="space-y-1">
            {groupRooms.map((room) => (
              <RoomButton
                key={roomKey(room)}
                room={room}
                active={roomKey(room) === selectedKey}
                onSelect={() => onSelect(roomKey(room))}
              />
            ))}
          </div>
        </div>
      )}

      {rooms.projects.length > 0 && (
        <div>
          <SectionHeading title="Projects" count={rooms.projects.length} />
          <div className="space-y-1">
            {rooms.projects.map((room) => (
              <RoomButton
                key={roomKey(room)}
                room={room}
                active={roomKey(room) === selectedKey}
                onSelect={() => onSelect(roomKey(room))}
              />
            ))}
          </div>
        </div>
      )}

      {!loading &&
        !rooms.departments.length &&
        !directRooms.length &&
        !groupRooms.length &&
        !rooms.projects.length && (
          <div className="py-8 text-center text-xs text-[var(--text-soft)]">
            No chat rooms available.
          </div>
        )}
    </div>
  );
}
