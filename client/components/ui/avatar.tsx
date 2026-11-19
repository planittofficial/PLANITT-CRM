import { useState, useEffect } from "react";
import type { UserPresenceStatus } from "@/types/crm";

interface AvatarProps {
  name: string;
  avatarUrl?: string | null;
  authProvider?: "google" | "password" | string;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  status?: "online" | "offline" | "busy" | "away" | UserPresenceStatus;
  statusTitle?: string;
  className?: string;
}

const sizeMap = {
  xs: "h-6 w-6 text-[10px]",
  sm: "h-7 w-7 text-xs",
  md: "h-9 w-9 text-xs",
  lg: "h-11 w-11 text-sm",
  xl: "h-14 w-14 text-base",
};

const statusSizeMap = {
  xs: "h-1.5 w-1.5 ring-1",
  sm: "h-2 w-2 ring-1.5",
  md: "h-2.5 w-2.5 ring-2",
  lg: "h-3 w-3 ring-2",
  xl: "h-3.5 w-3.5 ring-2",
};

const statusColorMap: Record<string, string> = {
  online: "bg-emerald-500",
  AVAILABLE: "bg-emerald-500",
  offline: "bg-slate-400 dark:bg-slate-500",
  OFFLINE: "bg-slate-400 dark:bg-slate-500",
  busy: "bg-rose-500",
  BUSY: "bg-rose-500",
  IN_A_MEETING: "bg-rose-500 ring-rose-400 animate-pulse",
  away: "bg-amber-500",
  AWAY: "bg-amber-500",
  DND: "bg-red-600 ring-red-300",
};

const colorPalette = [
  "from-blue-600 to-indigo-600",
  "from-emerald-600 to-teal-600",
  "from-purple-600 to-pink-600",
  "from-amber-600 to-orange-600",
  "from-rose-600 to-red-600",
  "from-cyan-600 to-blue-600",
];

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function getGradientByName(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % colorPalette.length;
  return colorPalette[index];
}

export function Avatar({
  name,
  avatarUrl,
  authProvider,
  size = "md",
  status,
  statusTitle,
  className = "",
}: AvatarProps) {
  const [imgFailed, setImgFailed] = useState(false);

  useEffect(() => {
    setImgFailed(false);
  }, [avatarUrl, authProvider]);

  const showImage = Boolean(avatarUrl) && !imgFailed;
  const gradient = getGradientByName(name || "User");

  return (
    <div
      className={`relative inline-flex shrink-0 ${className}`.trim()}
      title={statusTitle || name}
    >
      {showImage ? (
        <img
          src={avatarUrl as string}
          alt={name}
          className={`${sizeMap[size]} rounded-full object-cover ring-1 ring-[var(--border)]`}
          referrerPolicy="no-referrer"
          onError={() => setImgFailed(true)}
        />
      ) : (
        <div
          className={`${sizeMap[size]} rounded-full flex items-center justify-center font-bold text-white bg-gradient-to-br ${gradient} shadow-xs select-none`}
          aria-label={name}
        >
          <span>{getInitials(name || "U")}</span>
        </div>
      )}

      {status && (
        <span
          className={`absolute bottom-0 right-0 rounded-full ring-[var(--surface-strong,#ffffff)] ${statusSizeMap[size]} ${statusColorMap[status] || "bg-slate-400"}`}
          aria-hidden="true"
        />
      )}
    </div>
  );
}
