"use client";

import { useEffect, useState, useMemo, useRef, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { apiGet, apiPost } from "@/lib/api";
import { clearToken } from "@/lib/auth";
import { showToast } from "@/hooks/use-toast";
import { useCrmSearch } from "@/components/providers/crm-search-provider";
import { useTheme } from "@/components/providers/theme-provider";
import { usePresence } from "@/components/providers/presence-provider";
import { useNotificationsBackend } from "@/hooks/use-notifications-backend";
import { migrateLegacyThemeKeys } from "@/lib/theme-storage";
import { Avatar } from "@/components/ui/avatar";
import { FloatingQuickAction } from "@/components/layout/floating-quick-action";
import {
  LayoutDashboardIcon,
  FolderKanbanIcon,
  CheckSquareIcon,
  CalendarDaysIcon,
  UsersIcon,
  Building2Icon,
  ScrollTextIcon,
  MessageSquareIcon,
  SettingsIcon,
  BellIcon,
  SearchIcon,
  SunIcon,
  MoonIcon,
  LogOutIcon,
  ClockIcon,
  VideoIcon,
  TrendingUpIcon,
  HashIcon,
  MenuIcon,
  XIcon,
} from "@/components/ui/icons";
import type { CRMUser, UserPresenceStatus } from "@/types/crm";

type CRMShellProps = {
  children: ReactNode;
  user: CRMUser;
  compactMobileChrome?: boolean;
  fullBleed?: boolean;
};

type NavItem = {
  href: string;
  label: string;
  icon: (props: { size?: number; className?: string }) => ReactNode;
  badge?: number;
};

const roleLabels: Record<CRMUser["role"], string> = {
  SUPERADMIN: "CEO",
  ADMIN: "Admin",
  MANAGER: "Manager",
  EMPLOYEE: "Employee",
  INTERN: "Intern",
};

const pageMetadata: Record<string, { title: string; category: string }> = {
  "/dashboard": { title: "Dashboard", category: "Overview" },
  "/projects": { title: "Projects", category: "Work" },
  "/tasks": { title: "Tasks & Planner", category: "Work" },
  "/teams": { title: "Teams & Channels", category: "Collaboration" },
  "/calendar": { title: "Calendar & Meet", category: "Google Workspace" },
  "/crm": { title: "Sales & Deals Pipeline", category: "CRM" },
  "/leaves": { title: "Leaves", category: "HR" },
  "/employees": { title: "Employees", category: "Directory" },
  "/departments": { title: "Departments", category: "Organization" },
  "/logs": { title: "Logs", category: "System" },
  "/chat": { title: "Chats", category: "Communication" },
  "/settings": { title: "Settings", category: "Account" },
  "/notifications": { title: "Notifications", category: "Alerts" },
};

export function CRMShell({ children, user, compactMobileChrome = false, fullBleed = false }: CRMShellProps) {
  const pathname = usePathname();
  const isFullBleed = fullBleed || pathname === "/teams" || pathname === "/calendar" || pathname === "/crm";
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const { globalSearch, setGlobalSearch, submitSearch, searchNoResult, setSearchNoResult } = useCrmSearch();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [profileMenuPosition, setProfileMenuPosition] = useState<"header" | "rail">("header");
  const [checkedIn, setCheckedIn] = useState(false);
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const { getUserPresence, updateStatus, setMeetingStatus, clearMeetingStatus } = usePresence();
  const myLivePresence = getUserPresence(user.id);
  const currentStatus: UserPresenceStatus =
    myLivePresence?.status || user.presenceStatus || "AVAILABLE";
  const currentMessage: string =
    (myLivePresence?.customStatusMessage !== undefined
      ? myLivePresence.customStatusMessage
      : user.customStatusMessage) || "";

  const [statusMessageInput, setStatusMessageInput] = useState(currentMessage);

  useEffect(() => {
    setStatusMessageInput(currentMessage);
  }, [currentMessage]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (window.innerWidth < 640) {
          setMobileSearchOpen((prev) => !prev);
        } else {
          searchInputRef.current?.focus();
          searchInputRef.current?.select();
        }
      } else if (e.key === "Escape") {
        setMobileSearchOpen(false);
        setProfileMenuOpen(false);
        setNotificationsOpen(false);
        searchInputRef.current?.blur();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const { items = [], unreadCount = 0, markAllRead, markRead, clearAll } = useNotificationsBackend(user);

  useEffect(() => {
    migrateLegacyThemeKeys(user.id);
  }, [user.id]);

  useEffect(() => {
    setMobileMenuOpen(false);
    setProfileMenuOpen(false);
    setNotificationsOpen(false);
  }, [pathname]);

  const canUseAttendance =
    user.role === "SUPERADMIN" || user.role === "ADMIN" || user.role === "MANAGER";

  // Light-weight attendance check using dedicated endpoint
  useEffect(() => {
    if (!canUseAttendance) return;

    const checkAttendance = async () => {
      try {
        const res = await apiGet<{ checkedIn: boolean }>("/attendance/status");
        setCheckedIn(Boolean(res.checkedIn));
      } catch {
        setCheckedIn(false);
      }
    };

    void checkAttendance();

    const onAttendanceUpdated = () => void checkAttendance();
    window.addEventListener("attendance:local-updated", onAttendanceUpdated);
    return () => window.removeEventListener("attendance:local-updated", onAttendanceUpdated);
  }, [canUseAttendance]);

  const handleAttendanceToggle = async () => {
    try {
      setAttendanceLoading(true);
      if (checkedIn) {
        await apiPost("/attendance/checkout");
        setCheckedIn(false);
        showToast("Checked out successfully.", "success");
      } else {
        await apiPost("/attendance/checkin");
        setCheckedIn(true);
        showToast("Checked in successfully.", "success");
      }
      window.dispatchEvent(new CustomEvent("attendance:local-updated"));
    } catch (err) {
      showToast(
        err instanceof Error
          ? err.message
          : checkedIn
            ? "Failed to check out"
            : "Failed to check in",
        "error"
      );
    } finally {
      setAttendanceLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await apiPost<void>("/auth/logout");
    } catch {
      // Ignored
    }
    clearToken();
    router.replace("/login");
  };

  const toggleTheme = () => {
    setTheme(theme === "light" ? "dark" : "light");
  };

  const handleQuickMeetNow = async () => {
    try {
      const res = await apiPost<{ meetUrl: string }>("/calendar/quick-meet", {
        title: `${user.name} Instant Google Meet`,
      });
      if (res.meetUrl) {
        await setMeetingStatus(`${user.name} Instant Google Meet`);
        window.open(res.meetUrl, "_blank");
        await navigator.clipboard.writeText(res.meetUrl).catch(() => { });
        showToast("Google Meet launched! Status automatically set to In a Meeting (🔴)", "success");
      }
    } catch {
      showToast("Failed to launch Google Meet", "error");
    }
  };

  const renderProfileContent = (isMobile: boolean) => (
    <div className="space-y-3">
      {/* Header: User Profile with live dot */}
      <div className="flex items-start justify-between gap-2.5 border-b border-[var(--border)] pb-2.5">
        <div className="flex items-center gap-2.5 min-w-0">
          <Avatar
            name={user.name}
            avatarUrl={user.avatarUrl}
            authProvider={user.authProvider}
            size={isMobile ? "lg" : "md"}
            status={currentStatus}
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-[var(--text-main)]">{user.name}</p>
            <p className="truncate text-xs text-[var(--text-soft)]">
              {roleLabels[user.role]} · {user.email}
            </p>
            <div className="mt-1 flex items-center gap-1.5 flex-wrap">
              <span
                className={`h-2 w-2 rounded-full shrink-0 ${currentStatus === "AVAILABLE"
                  ? "bg-emerald-500"
                  : currentStatus === "BUSY"
                    ? "bg-rose-500"
                    : currentStatus === "IN_A_MEETING"
                      ? "bg-rose-500 animate-pulse"
                      : currentStatus === "AWAY"
                        ? "bg-amber-500"
                        : currentStatus === "DND"
                          ? "bg-red-600"
                          : "bg-slate-400"
                  }`}
              />
              <span className="text-xs font-semibold text-[var(--text-main)]">
                {currentStatus === "AVAILABLE"
                  ? "Available"
                  : currentStatus === "BUSY"
                    ? "Busy"
                    : currentStatus === "IN_A_MEETING"
                      ? "In a Meeting"
                      : currentStatus === "AWAY"
                        ? "Away"
                        : currentStatus === "DND"
                          ? "Do Not Disturb"
                          : "Offline"}
              </span>
              {currentMessage && (
                <span className="truncate text-xs italic text-[var(--text-soft)] max-w-[150px]" title={currentMessage}>
                  — "{currentMessage}"
                </span>
              )}
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setProfileMenuOpen(false)}
          className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--text-soft)] hover:bg-[var(--surface-soft)] hover:text-[var(--text-main)] transition-colors shrink-0"
          aria-label="Close profile menu"
        >
          <XIcon size={16} />
        </button>
      </div>

      {/* In-Meeting Quick Action Banner (if active) */}
      {currentStatus === "IN_A_MEETING" && (
        <div className="flex items-center justify-between rounded-xl bg-rose-500/10 border border-rose-500/20 px-3 py-1.5 text-xs text-rose-700 dark:text-rose-300">
          <span className="flex items-center gap-1.5 font-semibold text-xs">
            <span className="h-2 w-2 rounded-full bg-rose-500 animate-ping" />
            In a Meeting
          </span>
          <button
            type="button"
            onClick={async () => {
              await clearMeetingStatus();
              showToast("Status returned to Available (🟢)", "success");
            }}
            className="rounded-lg bg-rose-600 px-2.5 py-1 text-xs font-bold text-white hover:bg-rose-700 transition"
          >
            End / Set Available
          </button>
        </div>
      )}

      {/* Presence Status Selector */}
      <div>
        <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-faint)] px-1 mb-1.5">
          Set Presence Status
        </p>
        <div className="grid grid-cols-2 gap-1.5">
          {[
            { status: "AVAILABLE" as const, label: "Available", dot: "bg-emerald-500" },
            { status: "BUSY" as const, label: "Busy", dot: "bg-rose-500" },
            { status: "IN_A_MEETING" as const, label: "In a Meeting", dot: "bg-rose-500 ring-2 ring-rose-300 dark:ring-rose-800" },
            { status: "AWAY" as const, label: "Away", dot: "bg-amber-500" },
            { status: "DND" as const, label: "Do Not Disturb", dot: "bg-red-600" },
            { status: "OFFLINE" as const, label: "Appear Offline", dot: "bg-slate-400" },
          ].map((item) => (
            <button
              key={item.status}
              type="button"
              onClick={async () => {
                await updateStatus(item.status, currentMessage || null);
                showToast(`Status updated to ${item.label}`, "info");
                if (isMobile) setProfileMenuOpen(false);
              }}
              className={`flex items-center gap-2 rounded-xl px-2.5 py-2 min-h-[38px] text-xs font-medium transition text-left ${currentStatus === item.status
                ? "bg-[var(--accent)]/10 text-[var(--accent)] font-bold border border-[var(--accent)]/40 shadow-xs"
                : "text-[var(--text-main)] hover:bg-[var(--surface-soft)] border border-[var(--border)]"
                }`}
            >
              <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${item.dot}`} />
              <span className="truncate">{item.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Custom Status Message Editor */}
      <div className="border-t border-[var(--border)] pt-2.5">
        <div className="flex items-center justify-between mb-1 px-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-faint)]">
            Custom Status Message
          </span>
          {currentMessage && (
            <button
              type="button"
              onClick={async () => {
                setStatusMessageInput("");
                await updateStatus(currentStatus, null);
                showToast("Status message cleared", "info");
              }}
              className="text-[11px] text-rose-600 hover:underline font-semibold"
            >
              Clear
            </button>
          )}
        </div>

        <form
          onSubmit={async (e) => {
            e.preventDefault();
            await updateStatus(currentStatus, statusMessageInput.trim() || null);
            showToast("Status message updated", "success");
            if (isMobile) setProfileMenuOpen(false);
          }}
          className="space-y-1.5"
        >
          <div className="flex items-center gap-1.5">
            <input
              type="text"
              value={statusMessageInput}
              onChange={(e) => setStatusMessageInput(e.target.value)}
              placeholder="e.g., Traveling till 4 PM..."
              maxLength={100}
              className="flex-1 rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-1.5 text-xs text-[var(--text-main)] outline-none focus:border-[var(--accent)] focus:bg-[var(--surface-strong,#ffffff)] transition min-h-[36px]"
            />
            <button
              type="submit"
              className="rounded-xl bg-[var(--accent)] px-3 py-1.5 text-xs font-bold text-white hover:opacity-90 shadow-xs transition shrink-0 min-h-[36px]"
            >
              Save
            </button>
          </div>

          {/* Quick Preset Badges */}
          <div className="flex flex-wrap gap-1 pt-0.5">
            {[
              "Traveling till 4 PM",
              "Working on Q3 Pitch",
              "Focus time",
              "Out of office",
            ].map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={async () => {
                  setStatusMessageInput(preset);
                  await updateStatus(currentStatus, preset);
                  showToast(`Status message: "${preset}"`, "success");
                  if (isMobile) setProfileMenuOpen(false);
                }}
                className="rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] px-2.5 py-1 text-xs text-[var(--text-soft)] hover:border-[var(--accent)] hover:text-[var(--text-main)] transition"
              >
                {preset}
              </button>
            ))}
          </div>
        </form>
      </div>

      {/* Footer Navigation & Sign out */}
      <div className="border-t border-[var(--border)] pt-2.5 flex items-center justify-between text-xs">
        <Link
          href="/settings"
          onClick={() => setProfileMenuOpen(false)}
          className="flex items-center gap-1.5 text-[var(--text-soft)] hover:text-[var(--text-main)] font-semibold p-1.5 rounded-lg hover:bg-[var(--surface-soft)] transition-colors"
        >
          <SettingsIcon size={15} />
          <span>Settings</span>
        </Link>

        <button
          type="button"
          onClick={handleLogout}
          className="flex items-center gap-1.5 text-rose-600 hover:text-rose-700 font-semibold p-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
        >
          <LogOutIcon size={15} />
          <span>Sign Out</span>
        </button>
      </div>
    </div>
  );

  const renderNotificationsList = () => (
    <div className="max-h-[50vh] sm:max-h-72 overflow-y-auto space-y-2 pr-1">
      {items.length === 0 ? (
        <p className="py-8 text-center text-xs text-[var(--text-soft)]">No notifications right now.</p>
      ) : (
        items.slice(0, 15).map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => {
              markRead(item.id);
              setNotificationsOpen(false);
              if (item.href) router.push(item.href);
            }}
            className={`w-full rounded-xl border p-3 text-left text-xs transition-colors ${item.read
              ? "border-[var(--border)]/50 hover:bg-[var(--surface-soft)] text-[var(--text-soft)]"
              : "border-[var(--accent)]/30 bg-[var(--accent)]/5 text-[var(--text-main)] shadow-2xs"
              }`}
          >
            <div className="flex items-start justify-between gap-2">
              <p className="font-semibold text-[var(--text-main)]">{item.title}</p>
              {!item.read && <span className="h-2 w-2 rounded-full bg-[var(--accent)] shrink-0 mt-1" />}
            </div>
            <p className="mt-1 text-xs text-[var(--text-soft)] line-clamp-2">{item.message}</p>
            <p className="mt-1.5 text-[10px] text-[var(--text-faint)]">
              {new Date(item.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </p>
          </button>
        ))
      )}
    </div>
  );

  const navItems: NavItem[] = useMemo(() => {
    const isLeadership = user.role === "SUPERADMIN" || user.role === "ADMIN" || user.role === "MANAGER";
    const isAdmin = user.role === "SUPERADMIN" || user.role === "ADMIN";

    return [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboardIcon },
      { href: "/chat", label: "Chat", icon: MessageSquareIcon },
      { href: "/teams", label: "Teams", icon: HashIcon },
      { href: "/calendar", label: "Calendar & Meet", icon: CalendarDaysIcon },
      { href: "/crm", label: "Sales & Deals", icon: TrendingUpIcon },
      { href: "/tasks", label: "Tasks & Planner", icon: CheckSquareIcon },
      ...(isLeadership ? [{ href: "/projects", label: "Projects", icon: FolderKanbanIcon }] : []),
      ...(isLeadership ? [{ href: "/employees", label: "People", icon: UsersIcon }] : []),
      { href: "/leaves", label: "Leaves", icon: ClockIcon },
      ...(isAdmin ? [{ href: "/departments", label: "Depts", icon: Building2Icon }] : []),
      ...(isAdmin ? [{ href: "/logs", label: "Audit", icon: ScrollTextIcon }] : []),
      { href: "/notifications", label: "Activity", icon: BellIcon, badge: unreadCount },
      { href: "/settings", label: "Settings", icon: SettingsIcon },
    ];
  }, [user.role, unreadCount]);

  const currentPage = pageMetadata[pathname] ?? {
    title: pathname.startsWith("/leaves") ? "Leaves" : "Planitt CRM",
    category: "Workspace",
  };

  return (
    <div className="flex h-screen max-h-screen w-screen overflow-hidden bg-[var(--app-bg)] text-[var(--text-main)] font-sans antialiased">
      {/* ── TEAMS ACTIVITY RAIL (Left: 60px) ─────────────────────────────────── */}
      <aside
        className="hidden md:flex h-full max-h-screen w-[60px] shrink-0 flex-col items-center justify-between border-r border-[var(--border)] bg-[var(--surface-strong,#ffffff)] py-2.5 z-30 select-none shadow-[1px_0_4px_rgba(0,0,0,0.02)] min-h-0 overflow-visible"
        aria-label="Activity Rail"
      >
        {/* Top: Brand Logo */}
        <div className="flex flex-col items-center gap-2.5 w-full min-h-0 flex-1 overflow-hidden">
          <Link
            href="/dashboard"
            className="group flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--accent)] text-white font-black text-sm shadow-xs transition-transform hover:scale-105"
            title="Planitt CRM"
          >
            P
          </Link>

          {/* Navigation Items */}
          <nav className="flex flex-col items-center gap-1 w-full overflow-y-auto no-scrollbar py-1" aria-label="Main Navigation">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              const Icon = item.icon;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`group relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-all ${isActive
                    ? "bg-[var(--accent)] text-white shadow-xs"
                    : "text-[var(--text-soft)] hover:bg-[var(--surface-soft)] hover:text-[var(--text-main)]"
                    }`}
                  title={item.label}
                >
                  <Icon size={18} />
                  {typeof item.badge === "number" && item.badge > 0 && (
                    <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-600 px-1 text-[9px] font-black text-white shadow-2xs">
                      {item.badge > 99 ? "99+" : item.badge}
                    </span>
                  )}
                  {/* Tooltip flyout on hover */}
                  <span className="pointer-events-none absolute left-full ml-2 hidden whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-xs font-semibold text-white shadow-lg group-hover:block z-50">
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Bottom: Utility Controls */}
        <div className="flex flex-col items-center gap-1.5 shrink-0 pt-2 border-t border-[var(--border)] w-full">
          {/* Theme switch */}
          <button
            type="button"
            onClick={toggleTheme}
            className="group relative flex h-8 w-8 items-center justify-center rounded-xl text-[var(--text-soft)] hover:bg-[var(--surface-soft)] hover:text-[var(--text-main)] transition-colors"
            aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
            title={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
          >
            {theme === "light" ? <MoonIcon size={16} /> : <SunIcon size={16} />}
            <span className="pointer-events-none absolute left-full ml-2 hidden whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-xs font-semibold text-white shadow-lg group-hover:block z-50">
              {theme === "light" ? "Dark Mode" : "Light Mode"}
            </span>
          </button>

          {/* User Profile Avatar with Menu */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setProfileMenuPosition("rail");
                setProfileMenuOpen((prev) => !prev);
                setNotificationsOpen(false);
              }}
              className="flex rounded-full ring-2 ring-transparent transition hover:ring-[var(--accent)] focus:outline-none cursor-pointer"
              aria-label="User profile menu"
            >
              <Avatar
                name={user.name}
                avatarUrl={user.avatarUrl}
                authProvider={user.authProvider}
                size="sm"
                status={currentStatus}
                statusTitle={`${user.name} (${currentStatus})${currentMessage ? ` - "${currentMessage}"` : ""}`}
              />
            </button>

            {profileMenuOpen && profileMenuPosition === "rail" && (
              <div
                className="hidden md:block w-80 sm:w-88 max-h-[calc(100dvh-2.5rem)] overflow-y-auto overscroll-contain rounded-2xl border border-[var(--border)] bg-[var(--surface-strong,#ffffff)] p-3.5 sm:p-4 shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-100 absolute bottom-0 left-full ml-3"
                onClick={(e) => e.stopPropagation()}
              >
                {renderProfileContent(false)}
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* ── MAIN WORKSPACE CONTAINER ─────────────────────────────────────────── */}
      <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
        {/* ── TOP NAV BAR ──────────────────────────────────────────────────── */}
        <header
          className={`flex h-14 shrink-0 items-center justify-between border-b border-[var(--border)] bg-[var(--surface-strong,#ffffff)] px-3 sm:px-4 z-20 gap-2 sm:gap-3 select-none ${compactMobileChrome ? "hidden md:flex" : ""
            }`}
        >
          {/* Left: Hamburger & Page Title */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="flex md:hidden h-9 w-9 items-center justify-center rounded-xl border border-[var(--border)] text-[var(--text-main)] hover:bg-[var(--surface-soft)] active:scale-95 transition"
              aria-label="Open navigation menu"
            >
              <MenuIcon size={20} />
            </button>

            <div className="flex items-center gap-1.5 text-xs min-w-0">
              <span className="font-bold text-[var(--accent)] text-sm hidden sm:inline">Planitt CRM</span>
              <span className="text-[var(--text-faint)] hidden sm:inline">/</span>
              <span className="text-[var(--text-soft)] font-medium hidden md:inline">{currentPage.category}</span>
              <span className="text-[var(--text-faint)] hidden md:inline">/</span>
              <h1 className="text-sm font-bold text-[var(--text-main)] truncate max-w-[140px] sm:max-w-none">
                {currentPage.title}
              </h1>
            </div>
          </div>

          {/* Center: Global Search Bar (Desktop) */}
          <div className="flex-1 max-w-md hidden sm:block">
            <div className="relative flex items-center">
              <SearchIcon size={15} className="absolute left-3 text-[var(--text-soft)] pointer-events-none" />
              <input
                ref={searchInputRef}
                type="search"
                value={globalSearch}
                onChange={(e) => {
                  setGlobalSearch(e.target.value);
                  if (searchNoResult) setSearchNoResult(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    submitSearch();
                    const q = globalSearch.trim().toLowerCase();
                    if (!q) return;
                    const matched = Object.entries(pageMetadata).find(
                      ([href, meta]) =>
                        meta.title.toLowerCase() === q || href.slice(1) === q
                    );
                    if (matched) {
                      router.push(matched[0]);
                    } else {
                      setSearchNoResult(true);
                    }
                  }
                }}
                placeholder="Search CRM pages, tasks... (Press Enter)"
                className="h-9 w-full rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] pl-9 pr-14 text-xs text-[var(--text-main)] outline-none placeholder:text-[var(--text-faint)] focus:border-[var(--accent)] focus:bg-[var(--surface-strong,#ffffff)] focus:ring-1 focus:ring-[var(--accent)]/30 transition-all"
              />
              <span className="absolute right-2.5 rounded border border-[var(--border)] bg-[var(--surface-strong,#ffffff)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--text-faint)]">
                ⌘K
              </span>
            </div>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            {/* Mobile Search Button */}
            <button
              type="button"
              onClick={() => setMobileSearchOpen((o) => !o)}
              className="sm:hidden flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--border)] text-[var(--text-soft)] hover:bg-[var(--surface-soft)] active:scale-95 transition"
              aria-label="Toggle search"
            >
              <SearchIcon size={16} />
            </button>

            {/* Live In-Meeting Status Banner in Header (Desktop) */}
            {currentStatus === "IN_A_MEETING" && (
              <div className="hidden sm:flex items-center gap-1.5 rounded-xl bg-rose-100 border border-rose-300 px-2.5 py-1 text-xs font-bold text-rose-800 dark:bg-rose-950/60 dark:border-rose-800 dark:text-rose-200">
                <span className="h-2 w-2 rounded-full bg-rose-500 animate-pulse" />
                <span>In Meeting</span>
                <button
                  type="button"
                  onClick={async () => {
                    await clearMeetingStatus();
                    showToast("Meeting ended, status set to Available", "success");
                  }}
                  className="rounded bg-rose-600 hover:bg-rose-700 text-white px-1.5 py-0.5 text-[10px] font-semibold transition"
                  title="End meeting status"
                >
                  End
                </button>
              </div>
            )}

            {/* Quick Google Meet Action */}
            <button
              type="button"
              onClick={handleQuickMeetNow}
              className="inline-flex items-center justify-center h-9 w-9 sm:w-auto sm:px-3 gap-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white shadow-xs transition active:scale-95"
              title="Instant Google Meet"
              aria-label="Instant Google Meet"
            >
              <VideoIcon size={15} />
              <span className="hidden sm:inline text-xs font-bold">Meet</span>
            </button>

            {/* Quick Attendance Action (Desktop/Tablet) */}
            {canUseAttendance && (
              <button
                type="button"
                onClick={handleAttendanceToggle}
                disabled={attendanceLoading}
                className={`hidden sm:inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition-all shadow-xs active:scale-95 ${checkedIn
                  ? "bg-rose-600 hover:bg-rose-700 text-white"
                  : "bg-emerald-600 hover:bg-emerald-700 text-white"
                  }`}
                title={checkedIn ? "Click to check out" : "Click to check in"}
              >
                <ClockIcon size={14} />
                <span>{attendanceLoading ? "..." : checkedIn ? "Check Out" : "Check In"}</span>
              </button>
            )}

            {/* Notification Bell */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setNotificationsOpen((prev) => !prev)}
                className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--border)] text-[var(--text-soft)] hover:bg-[var(--surface-soft)] hover:text-[var(--text-main)] active:scale-95 transition"
                aria-label="View notifications"
              >
                <BellIcon size={17} />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-600 px-1 text-[9px] font-black text-white shadow-xs">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </button>

              {/* Notification Popover (Desktop) */}
              {notificationsOpen && (
                <div
                  className="hidden md:block absolute right-0 top-full mt-2 w-80 sm:w-96 rounded-2xl border border-[var(--border)] bg-[var(--surface-strong,#ffffff)] p-4 shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-100"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center justify-between border-b border-[var(--border)] pb-2.5 mb-2.5">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-[var(--text-main)]">Notifications</span>
                      {unreadCount > 0 && (
                        <span className="rounded-full bg-[var(--accent)]/10 px-2 py-0.5 text-[10px] font-bold text-[var(--accent)]">
                          {unreadCount} new
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs">
                      <button
                        type="button"
                        onClick={markAllRead}
                        className="text-[var(--accent)] hover:underline font-semibold"
                      >
                        Read all
                      </button>
                      <button
                        type="button"
                        onClick={clearAll}
                        className="text-[var(--text-soft)] hover:text-rose-600 font-medium"
                      >
                        Clear
                      </button>
                    </div>
                  </div>
                  {renderNotificationsList()}
                </div>
              )}
            </div>

            {/* User Profile Avatar with Menu (Header - Desktop & Mobile) */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setProfileMenuPosition("header");
                  setProfileMenuOpen((prev) => !prev);
                  setNotificationsOpen(false);
                }}
                className="flex rounded-full ring-2 ring-transparent transition hover:ring-[var(--accent)] active:scale-95 focus:outline-none cursor-pointer"
                aria-label="User profile and presence"
              >
                <Avatar
                  name={user.name}
                  avatarUrl={user.avatarUrl}
                  authProvider={user.authProvider}
                  size="sm"
                  status={currentStatus}
                  statusTitle={`${user.name} (${currentStatus})${currentMessage ? ` - "${currentMessage}"` : ""}`}
                />
              </button>

              {/* Desktop Header Profile Popover */}
              {profileMenuOpen && profileMenuPosition === "header" && (
                <div
                  className="hidden md:block absolute right-0 top-full mt-2 w-80 sm:w-88 max-h-[calc(100dvh-4.5rem)] overflow-y-auto overscroll-contain rounded-2xl border border-[var(--border)] bg-[var(--surface-strong,#ffffff)] p-3.5 sm:p-4 shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-100"
                  onClick={(e) => e.stopPropagation()}
                >
                  {renderProfileContent(false)}
                </div>
              )}
            </div>
          </div>
        </header>

        {/* ── ACTIVE MEETING BANNER (TEAMS AUTO-MEET STATUS) ────────────────── */}
        {currentStatus === "IN_A_MEETING" && (
          <div className="flex items-center justify-between bg-gradient-to-r from-rose-600 to-rose-700 px-4 py-2 text-xs font-semibold text-white shadow-sm z-30 select-none animate-in fade-in duration-150">
            <div className="flex items-center gap-2.5">
              <span className="flex h-2.5 w-2.5 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-white" />
              </span>
              <span className="tracking-wide">In a Google Meet · Teams Status: In a Meeting (🔴)</span>
            </div>
            <button
              type="button"
              onClick={async () => {
                await clearMeetingStatus();
                showToast("Meeting ended. Teams status restored to Available (🟢)", "success");
              }}
              className="rounded-lg bg-white/20 hover:bg-white/30 px-3 py-1 text-xs font-bold transition-colors active:scale-95"
            >
              End Call · Set Available
            </button>
          </div>
        )}

        {/* ── EXPANDABLE MOBILE SEARCH BAR ────────────────────────────────────── */}
        {mobileSearchOpen && (
          <div className="flex sm:hidden items-center px-3 py-2 bg-[var(--surface-strong,#ffffff)] border-b border-[var(--border)] gap-2 animate-in fade-in duration-100 z-20">
            <div className="relative flex-1">
              <SearchIcon size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-soft)]" />
              <input
                type="search"
                autoFocus
                value={globalSearch}
                onChange={(e) => {
                  setGlobalSearch(e.target.value);
                  if (searchNoResult) setSearchNoResult(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    submitSearch();
                    const q = globalSearch.trim().toLowerCase();
                    if (!q) return;
                    const matched = Object.entries(pageMetadata).find(
                      ([href, meta]) =>
                        meta.title.toLowerCase() === q || href.slice(1) === q
                    );
                    if (matched) {
                      setMobileSearchOpen(false);
                      router.push(matched[0]);
                    } else {
                      setSearchNoResult(true);
                    }
                  }
                }}
                placeholder="Search CRM pages, tasks... (Enter)"
                className="h-10 w-full rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] pl-9 pr-3 text-xs text-[var(--text-main)] outline-none focus:border-[var(--accent)]"
              />
            </div>
            <button
              type="button"
              onClick={() => setMobileSearchOpen(false)}
              className="text-xs font-bold text-[var(--text-soft)] px-2 py-1"
            >
              Cancel
            </button>
          </div>
        )}

        {/* ── MOBILE NOTIFICATIONS BOTTOM SHEET ─────────────────────────────────── */}
        {notificationsOpen && (
          <div className="fixed inset-0 z-50 flex flex-col justify-end md:hidden animate-in fade-in duration-200">
            <div
              className="fixed inset-0 bg-black/60 backdrop-blur-xs"
              onClick={() => setNotificationsOpen(false)}
            />
            <div className="relative w-full rounded-t-3xl border-t border-[var(--border)] bg-[var(--surface-strong,#ffffff)] p-5 shadow-2xl z-10 max-h-[85vh] flex flex-col pb-[max(1.5rem,env(safe-area-inset-bottom,16px))] animate-in slide-in-from-bottom duration-250">
              <div className="mx-auto mb-3 h-1 w-12 rounded-full bg-slate-300 dark:bg-slate-700" />
              <div className="flex items-center justify-between pb-3 border-b border-[var(--border)]">
                <div className="flex items-center gap-2">
                  <span className="text-base font-bold text-[var(--text-main)]">Notifications</span>
                  {unreadCount > 0 && (
                    <span className="rounded-full bg-[var(--accent)]/10 px-2.5 py-0.5 text-xs font-bold text-[var(--accent)]">
                      {unreadCount} new
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={markAllRead}
                    className="text-xs text-[var(--accent)] hover:underline font-bold"
                  >
                    Read all
                  </button>
                  <button
                    type="button"
                    onClick={clearAll}
                    className="text-xs text-[var(--text-soft)] hover:text-rose-600 font-medium"
                  >
                    Clear
                  </button>
                  <button
                    type="button"
                    onClick={() => setNotificationsOpen(false)}
                    className="p-1 rounded-full text-[var(--text-soft)] hover:bg-[var(--surface-soft)] ml-1"
                    aria-label="Close"
                  >
                    <XIcon size={18} />
                  </button>
                </div>
              </div>
              <div className="mt-3 overflow-y-auto">
                {renderNotificationsList()}
              </div>
            </div>
          </div>
        )}

        {/* ── DESKTOP BACKDROP TO DISMISS FLYOUTS ON CLICK OUTSIDE ───────────── */}
        {(profileMenuOpen || notificationsOpen) && (
          <div
            className="hidden md:block fixed inset-0 z-40 bg-transparent"
            onClick={() => {
              setProfileMenuOpen(false);
              setNotificationsOpen(false);
            }}
          />
        )}

        {/* ── MOBILE USER PROFILE & PRESENCE BOTTOM SHEET ───────────────────────── */}
        {profileMenuOpen && (
          <div className="fixed inset-0 z-50 flex flex-col justify-end md:hidden animate-in fade-in duration-200">
            <div
              className="fixed inset-0 bg-black/60 backdrop-blur-xs"
              onClick={() => setProfileMenuOpen(false)}
            />
            <div className="relative w-full rounded-t-3xl border-t border-[var(--border)] bg-[var(--surface-strong,#ffffff)] p-5 shadow-2xl z-10 max-h-[85vh] overflow-y-auto pb-[max(1.5rem,env(safe-area-inset-bottom,16px))] animate-in slide-in-from-bottom duration-250">
              <div className="mx-auto mb-3 h-1 w-12 rounded-full bg-slate-300 dark:bg-slate-700" />
              {renderProfileContent(true)}
            </div>
          </div>
        )}

        {/* ── MOBILE NAVIGATION DRAWER ────────────────────────────────────────── */}
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-50 flex md:hidden animate-in fade-in duration-200">
            <div
              className="fixed inset-0 bg-black/60 backdrop-blur-xs"
              onClick={() => setMobileMenuOpen(false)}
            />
            <div className="relative flex w-[82vw] max-w-xs flex-col bg-[var(--surface-strong,#ffffff)] shadow-2xl z-10 border-r border-[var(--border)] animate-in slide-in-from-left duration-250">
              {/* Drawer Header with Brand & User Info */}
              <div className="border-b border-[var(--border)] p-4 bg-[var(--surface-soft)]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--accent)] text-white font-black text-sm shadow-xs">
                      P
                    </div>
                    <div>
                      <p className="text-sm font-bold text-[var(--text-main)]">Planitt CRM</p>
                      <span className="inline-block rounded-md bg-indigo-50 px-1.5 py-0.2 text-[10px] font-bold text-[var(--accent)] dark:bg-indigo-950/50">
                        {roleLabels[user.role]}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-soft)] hover:bg-[var(--surface-hover)] active:scale-95"
                    aria-label="Close menu"
                  >
                    <XIcon size={18} />
                  </button>
                </div>

                {/* Quick Attendance Toggle inside Drawer */}
                {canUseAttendance && (
                  <div className="mt-3.5 flex items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--surface-strong,#ffffff)] p-2.5">
                    <div className="flex items-center gap-2">
                      <ClockIcon size={15} className={checkedIn ? "text-emerald-600 dark:text-emerald-400" : "text-slate-500 dark:text-slate-400"} />
                      <span className="text-xs font-semibold text-[var(--text-main)]">
                        {checkedIn ? "Checked In" : "Not Checked In"}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={handleAttendanceToggle}
                      disabled={attendanceLoading}
                      className={`rounded-lg px-3 py-1 text-xs font-bold transition shadow-xs ${checkedIn
                        ? "bg-rose-600 text-white hover:bg-rose-700"
                        : "bg-emerald-600 text-white hover:bg-emerald-700"
                        }`}
                    >
                      {attendanceLoading ? "..." : checkedIn ? "Check Out" : "Check In"}
                    </button>
                  </div>
                )}
              </div>

              {/* Navigation Items */}
              <nav className="mt-2 flex-1 overflow-y-auto p-3 space-y-1">
                {navItems.map((item) => {
                  const isActive = pathname === item.href;
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`flex items-center justify-between rounded-xl px-3 py-2.5 text-xs font-semibold transition ${isActive
                        ? "bg-[var(--accent)] text-white shadow-xs"
                        : "text-[var(--text-main)] hover:bg-[var(--surface-soft)]"
                        }`}
                    >
                      <div className="flex items-center gap-3">
                        <Icon size={18} />
                        <span>{item.label}</span>
                      </div>
                      {typeof item.badge === "number" && item.badge > 0 && (
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${isActive ? "bg-white text-[var(--accent)]" : "bg-rose-600 text-white"
                          }`}>
                          {item.badge}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </nav>

              {/* Drawer Footer */}
              <div className="border-t border-[var(--border)] p-3 space-y-2 pb-[max(1rem,env(safe-area-inset-bottom,12px))]">
                <button
                  type="button"
                  onClick={toggleTheme}
                  className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-xs font-semibold text-[var(--text-soft)] hover:bg-[var(--surface-soft)] transition"
                >
                  <span className="flex items-center gap-2">
                    {theme === "light" ? <MoonIcon size={16} /> : <SunIcon size={16} />}
                    <span>{theme === "light" ? "Dark Mode" : "Light Mode"}</span>
                  </span>
                </button>

                <button
                  type="button"
                  onClick={handleLogout}
                  className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition"
                >
                  <LogOutIcon size={16} />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── CONTENT BODY VIEWPORT ─────────────────────────────────────────── */}
        {isFullBleed ? (
          <main className="flex-1 min-h-0 overflow-hidden flex flex-col w-full">
            <div className="flex-1 min-h-0 w-full flex flex-col">
              {children}
            </div>
          </main>
        ) : (
          <main className="flex-1 overflow-y-auto overflow-x-hidden p-3 sm:p-5 lg:p-6 pb-20 md:pb-6">
            <div className="mx-auto max-w-7xl w-full">
              {children}
            </div>
          </main>
        )}

        {/* ── PLANITT CRM FLOATING QUICK ACTION HUB (COPILOT) ────────────────── */}
        <FloatingQuickAction user={user} />

        {/* ── MOBILE BOTTOM NAVIGATION BAR ─────────────────────────────────────── */}
        <nav
          className="flex md:hidden items-center justify-around border-t border-[var(--border)] bg-[var(--surface-strong,#ffffff)]/95 backdrop-blur-md z-20 pb-[max(0.4rem,env(safe-area-inset-bottom,0px))] pt-1 px-1 h-[calc(3.5rem+env(safe-area-inset-bottom,0px))] select-none"
          aria-label="Mobile Navigation"
        >
          {[
            { href: "/dashboard", label: "Home", icon: LayoutDashboardIcon },
            { href: "/chat", label: "Chat", icon: MessageSquareIcon },
            { href: "/teams", label: "Teams", icon: HashIcon },
            { href: "/crm", label: "Deals", icon: TrendingUpIcon },
            { href: "/notifications", label: "Alerts", icon: BellIcon, badge: unreadCount },
          ].map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`relative flex flex-col items-center justify-center flex-1 py-1 transition-all ${isActive
                  ? "text-[var(--accent)] font-bold scale-105"
                  : "text-[var(--text-soft)] hover:text-[var(--text-main)]"
                  }`}
              >
                <div className="relative">
                  <Icon size={19} />
                  {typeof item.badge === "number" && item.badge > 0 && (
                    <span className="absolute -top-1 -right-2 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-rose-600 px-0.5 text-[8px] font-black text-white">
                      {item.badge > 9 ? "9+" : item.badge}
                    </span>
                  )}
                </div>
                <span className="text-[10px] tracking-tight mt-0.5">{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
