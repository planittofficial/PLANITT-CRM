"use client";

import { useEffect, useState } from "react";
import type { CRMUser } from "@/types/crm";

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
};

export function UserAvatar({ name, avatarUrl, authProvider, className, imageClassName = "object-cover" }: UserAvatarProps) {
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    setImageFailed(false);
  }, [avatarUrl, authProvider]);

  const showPhoto = authProvider === "google" && Boolean(avatarUrl) && !imageFailed;

  if (showPhoto) {
    return (
      <img
        src={avatarUrl as string}
        alt={`${name} profile picture`}
        className={`block ${className} ${imageClassName}`}
        referrerPolicy="no-referrer"
        onError={() => setImageFailed(true)}
      />
    );
  }

  return (
    <div
      className={`flex items-center justify-center font-bold text-white ${className}`}
      style={{
        background: "linear-gradient(135deg, rgba(255,255,255,0.24), rgba(255,255,255,0.12))",
      }}
      aria-label={`${name} default avatar`}
    >
      <span>{initials(name)}</span>
    </div>
  );
}
