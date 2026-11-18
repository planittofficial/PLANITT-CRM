"use client";

import { useEffect, useState } from "react";
import type { CRMUser, UserPresenceStatus } from "@/types/crm";

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

type UserAvatarProps = {
  name: string;
  avatarUrl?: string | null;
  authProvider?: CRMUser["authProvider"];
  className: string;
  imageClassName?: string;
  status?: "online" | "offline" | "busy" | "away" | UserPresenceStatus;
};

export function UserAvatar({
  name,
  avatarUrl,
  authProvider,
  className,
  imageClassName = "object-cover",
  status,
}: UserAvatarProps) {
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    setImageFailed(false);
  }, [avatarUrl, authProvider]);

  const showPhoto = Boolean(avatarUrl) && !imageFailed;

  return (
    <div className={`relative inline-flex shrink-0 ${className}`}>
      {showPhoto ? (
        <img
          src={avatarUrl as string}
          alt={`${name} profile picture`}
          className={`h-full w-full rounded-full ${imageClassName}`}
          referrerPolicy="no-referrer"
          onError={() => setImageFailed(true)}
        />
      ) : (
        <div
          className="flex h-full w-full items-center justify-center rounded-full bg-[var(--accent)] font-bold text-white shadow-2xs select-none"
          aria-label={`${name} default avatar`}
        >
          <span>{initials(name || "U")}</span>
        </div>
      )}

      {status && (
        <span
          className={`absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full ring-2 ring-[var(--surface-strong,#ffffff)] ${
            status === "online" || status === "AVAILABLE"
              ? "bg-emerald-500"
              : status === "busy" || status === "BUSY"
              ? "bg-rose-500"
              : status === "IN_A_MEETING"
              ? "bg-rose-500 ring-rose-400 animate-pulse"
              : status === "away" || status === "AWAY"
              ? "bg-amber-500"
              : status === "DND"
              ? "bg-red-600 ring-red-400"
              : "bg-slate-400"
          }`}
          aria-hidden
        />
      )}
    </div>
  );
}
