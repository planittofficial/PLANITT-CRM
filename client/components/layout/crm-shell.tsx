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
} from "@/components/ui/icons";
import type { CRMUser, UserPresenceStatus } from "@/types/crm";

type CRMShellProps = {
  children: ReactNode;
  user: CRMUser;
  compactMobileChrome?: boolean;
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

export function CRMShell({ children, user, compactMobileChrome = false }: CRMShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const { globalSearch, setGlobalSearch, submitSearch, searchNoResult, setSearchNoResult } = useCrmSearch();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
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
        await navigator.clipboard.writeText(res.meetUrl).catch(() => {});
        showToast("Google Meet launched! Status automatically set to In a Meeting (🔴)", "success");
      }
    } catch {
      showToast("Failed to launch Google Meet", "error");
    }
  };

  const renderProfileMenu = (placement: "desktop" | "mobile") => (
    <div
      className={`w-72 sm:w-80 rounded-2xl border border-[var(--border)] bg-[var(--surface-strong,#ffffff)] p-3.5 shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-100 ${
        placement === "desktop"
          ? "absolute bottom-2 left-full ml-3"
          : "absolute right-0 top-full mt-2"
      }`}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header: User Profile with live dot */}
      <div className="flex items-start gap-3 border-b border-[var(--border)] pb-3">
        <Avatar
          name={user.name}
          avatarUrl={user.avatarUrl}
          authProvider={user.authProvider}
          size="md"
          status={currentStatus}
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-[var(--text-main)]">{user.name}</p>
          <p className="truncate text-xs text-[var(--text-soft)]">
            {roleLabels[user.role]} · {user.email}
          </p>
          <div className="mt-1 flex items-center gap-1.5 flex-wrap">
            <span
              className={`h-2 w-2 rounded-full shrink-0 ${
                currentStatus === "AVAILABLE"
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
            <span className="text-[11px] font-semibold text-[var(--text-main)]">
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
              <span className="truncate text-[11px] italic text-[var(--text-soft)]" title={currentMessage}>
                — "{currentMessage}"
              </span>
            )}
          </div>
        </div>
      </div>

      {/* In-Meeting Quick Action Banner (if active) */}
      {currentStatus === "IN_A_MEETING" && (
        <div className="mt-2.5 flex items-center justify-between rounded-xl bg-rose-500/10 border border-rose-500/20 px-2.5 py-1.5 text-xs text-rose-700 dark:text-rose-300">
          <span className="flex items-center gap-1.5 font-semibold text-[11px]">
            <span className="h-2 w-2 rounded-full bg-rose-500 animate-ping" />
            In a Meeting
          </span>
          <button
            type="button"
            onClick={async () => {
              await clearMeetingStatus();
              showToast("Status returned to Available (🟢)", "success");
            }}
            className="rounded bg-rose-600 px-2 py-0.5 text-[10px] font-bold text-white hover:bg-rose-700 transition"
          >
            End / Set Available
          </button>
        </div>
      )}

      {/* Presence Status Selector */}
      <div className="mt-2.5">
        <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-faint)] px-1 mb-1">
          Set Presence Status
        </p>
        <div className="grid grid-cols-2 gap-1">
          {[
            { status: "AVAILABLE" as const, label: "Available", dot: "bg-emerald-500" },
            { status: "BUSY" as const, label: "Busy", dot: "bg-rose-500" },
            { status: "IN_A_MEETING" as const, label: "In a Meeting", dot: "bg-rose-500 ring-1 ring-rose-400" },
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
              }}
              className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs font-medium transition ${
                currentStatus === item.status
                  ? "bg-[var(--accent)]/10 text-[var(--accent)] font-semibold border border-[var(--accent)]/30"
                  : "text-[var(--text-main)] hover:bg-[var(--surface-soft)] border border-transparent"
              }`}
            >
              <span className={`h-2 w-2 rounded-full shrink-0 ${item.dot}`} />
              <span className="truncate">{item.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Custom Status Message Editor */}
      <div className="mt-2.5 border-t border-[var(--border)] pt-2.5">
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
              className="text-[10px] text-rose-600 hover:underline"
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
              className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] px-2.5 py-1 text-xs text-[var(--text-main)] outline-none focus:border-[var(--accent)] focus:bg-[var(--surface-strong,#ffffff)] transition"
            />
            <button
              type="submit"
              className="rounded-lg bg-[var(--accent)] px-2.5 py-1 text-xs font-bold text-white hover:opacity-90 shadow-2xs transition shrink-0"
            >
              Save
            </button>
          </div>

          {/* Quick Preset Badges */}
          <div className="flex flex-wrap gap-1 pt-0.5">
            {[
              "Traveling till 4 PM",
              "Working on Q3 Pitch",
              "Focus time 🎯",
              "Out of office 🌴",
            ].map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={async () => {
                  setStatusMessageInput(preset);
                  await updateStatus(currentStatus, preset);
                  showToast(`Status message: "${preset}"`, "success");
                }}
                className="rounded-md border border-[var(--border)] bg-[var(--surface-soft)] px-1.5 py-0.5 text-[10px] text-[var(--text-soft)] hover:border-[var(--accent)] hover:text-[var(--text-main)] transition"
              >
                {preset}
              </button>
            ))}
          </div>
        </form>
      </div>

      {/* Footer Navigation & Sign out */}
      <div className="mt-3 border-t border-[var(--border)] pt-2 flex items-center justify-between text-xs">
        <Link
          href="/settings"
          onClick={() => setProfileMenuOpen(false)}
          className="flex items-center gap-1.5 text-[var(--text-soft)] hover:text-[var(--text-main)] font-medium"
        >
          <SettingsIcon size={14} />
          <span>Settings</span>
        </Link>

        <button
          type="button"
          onClick={handleLogout}
          className="flex items-center gap-1.5 text-rose-600 hover:text-rose-700 font-medium"
        >
          <LogOutIcon size={14} />
          <span>Sign Out</span>
        </button>
      </div>
    </div>
  );

  const navItems: NavItem[] = useMemo(() => {
    const isLeadership = user.role === "SUPERADMIN" || user.role === "ADMIN" || user.role === "MANAGER";
    const isAdmin = user.role === "SUPERADMIN" || user.role === "ADMIN";

    return [
      { href: "/notifications", label: "Activity", icon: BellIcon, badge: unreadCount },
      { href: "/chat", label: "Chat", icon: MessageSquareIcon },
      { href: "/teams", label: "Teams", icon: HashIcon },
      { href: "/calendar", label: "Calendar & Meet", icon: CalendarDaysIcon },
      { href: "/crm", label: "Sales & Deals", icon: TrendingUpIcon },
      { href: "/tasks", label: "Tasks & Planner", icon: CheckSquareIcon },
      ...(isLeadership ? [{ href: "/projects", label: "Projects", icon: FolderKanbanIcon }] : []),
      { href: "/dashboard", label: "Hub & Overview", icon: LayoutDashboardIcon },
      ...(isLeadership ? [{ href: "/employees", label: "People", icon: UsersIcon }] : []),
      { href: "/leaves", label: "Leaves", icon: ClockIcon },
      ...(isAdmin ? [{ href: "/departments", label: "Depts", icon: Building2Icon }] : []),
      ...(isAdmin ? [{ href: "/logs", label: "Audit", icon: ScrollTextIcon }] : []),
      { href: "/settings", label: "Settings", icon: SettingsIcon },
    ];
  }, [user.role, unreadCount]);

  const currentPage = pageMetadata[pathname] ?? {
    title: pathname.startsWith("/leaves") ? "Leaves" : "Planitt CRM",
    category: "Workspace",
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[var(--app-bg)] text-[var(--text-main)] font-sans antialiased">
      {/* ── TEAMS ACTIVITY RAIL (Left: 60px) ─────────────────────────────────── */}
      <aside
        className="hidden md:flex h-full w-[60px] shrink-0 flex-col items-center justify-between border-r border-[var(--border)] bg-[var(--surface-strong,#ffffff)] py-3 z-30 select-none shadow-[1px_0_4px_rgba(0,0,0,0.02)]"
        aria-label="Activity Rail"
      >
        {/* Top: Brand Logo */}
        <div className="flex flex-col items-center gap-4">
          <Link
            href="/dashboard"
            className="group flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--accent)] text-white font-black text-sm shadow-xs transition-transform hover:scale-105"
            title="Planitt CRM"
          >
            P
          </Link>

          {/* Navigation Items */}
          <nav className="flex flex-col items-center gap-1.5" aria-label="Main Navigation">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              const Icon = item.icon;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`group relative flex h-10 w-10 items-center justify-center rounded-xl transition-all ${
                    isActive
                      ? "bg-[var(--accent)] text-white shadow-xs"
                      : "text-[var(--text-soft)] hover:bg-[var(--surface-soft)] hover:text-[var(--text-main)]"
                  }`}
                  title={item.label}
                >
                  <Icon size={19} />
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
        <div className="flex flex-col items-center gap-2">
          {/* Theme switch */}
          <button
            type="button"
            onClick={toggleTheme}
            className="group relative flex h-9 w-9 items-center justify-center rounded-xl text-[var(--text-soft)] hover:bg-[var(--surface-soft)] hover:text-[var(--text-main)] transition-colors"
            aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
            title={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
          >
            {theme === "light" ? <MoonIcon size={17} /> : <SunIcon size={17} />}
            <span className="pointer-events-none absolute left-full ml-2 hidden whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-xs font-semibold text-white shadow-lg group-hover:block z-50">
              {theme === "light" ? "Dark Mode" : "Light Mode"}
            </span>
          </button>

          {/* User Profile Avatar with Menu */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setProfileMenuOpen((prev) => !prev)}
              className="flex rounded-full ring-2 ring-transparent transition hover:ring-[var(--accent)] focus:outline-none"
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

            {profileMenuOpen && renderProfileMenu("desktop")}
          </div>
        </div>
      </aside>

      {/* ── MAIN WORKSPACE CONTAINER ─────────────────────────────────────────── */}
      <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
        {/* ── TOP NAV BAR (52px) ────────────────────────────────────────────── */}
        <header
          className={`flex h-[52px] shrink-0 items-center justify-between border-b border-[var(--border)] bg-[var(--surface-strong,#ffffff)] px-4 z-20 gap-3 select-none ${
            compactMobileChrome ? "hidden md:flex" : ""
          }`}
        >
          {/* Left: Breadcrumbs & Mobile Menu Trigger */}
          <div className="flex items-center gap-3 min-w-0">
            {/* Mobile Hamburger */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen((o) => !o)}
              className="flex md:hidden h-8 w-8 items-center justify-center rounded-lg border border-[var(--border)] text-[var(--text-main)] hover:bg-[var(--surface-soft)]"
              aria-label="Toggle navigation"
            >
              ☰
            </button>

            {/* Breadcrumb */}
            <div className="flex items-center gap-1.5 text-xs">
              <span className="font-semibold text-[var(--accent)] hidden sm:inline">Planitt CRM</span>
              <span className="text-[var(--text-faint)] hidden sm:inline">/</span>
              <span className="text-[var(--text-soft)] font-medium hidden md:inline">{currentPage.category}</span>
              <span className="text-[var(--text-faint)] hidden md:inline">/</span>
              <h1 className="text-sm font-bold text-[var(--text-main)] truncate">{currentPage.title}</h1>
            </div>
          </div>

          {/* Center: Global Search Bar */}
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
                placeholder="Search tasks, projects, employees... (Press Enter)"
                className="h-8 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] pl-8 pr-16 text-xs text-[var(--text-main)] outline-none placeholder:text-[var(--text-faint)] focus:border-[var(--accent)] focus:bg-[var(--surface-strong,#ffffff)] focus:ring-1 focus:ring-[var(--accent)]/30 transition-all"
              />
              <span className="absolute right-2.5 rounded border border-[var(--border)] bg-[var(--surface-strong,#ffffff)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--text-faint)]">
                ⌘K
              </span>
            </div>
          </div>

          {/* Right: Actions (Attendance, Notifications, Avatar) */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Mobile Search Button */}
            <button
              type="button"
              onClick={() => setMobileSearchOpen((o) => !o)}
              className="sm:hidden flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border)] text-[var(--text-soft)] hover:bg-[var(--surface-soft)]"
              aria-label="Toggle search"
            >
              <SearchIcon size={15} />
            </button>

            {/* Live In-Meeting Status Banner in Header */}
            {currentStatus === "IN_A_MEETING" && (
              <div className="flex items-center gap-1.5 rounded-lg bg-rose-50 border border-rose-200 px-2 py-1 text-xs font-bold text-rose-700 dark:bg-rose-950/40 dark:border-rose-800 dark:text-rose-300">
                <span className="h-2 w-2 rounded-full bg-rose-500 animate-pulse" />
                <span className="hidden sm:inline">In Meeting</span>
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
              className="inline-flex items-center gap-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 px-2.5 py-1 text-xs font-bold text-white shadow-2xs transition"
              title="Instant Google Meet"
            >
              <VideoIcon size={13} />
              <span className="hidden sm:inline">Meet</span>
            </button>

            {/* Quick Attendance Action */}
            {canUseAttendance && (
              <button
                type="button"
                onClick={handleAttendanceToggle}
                disabled={attendanceLoading}
                className={`inline-flex items-center gap-1 sm:gap-1.5 rounded-lg px-2 sm:px-2.5 py-1 text-xs font-semibold transition-all shadow-2xs ${
                  checkedIn
                    ? "bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800"
                    : "bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800"
                }`}
                title={checkedIn ? "Click to check out" : "Click to check in"}
              >
                <ClockIcon size={13} />
                <span>{attendanceLoading ? "..." : checkedIn ? "Check Out" : "Check In"}</span>
              </button>
            )}

            {/* Notification Bell */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setNotificationsOpen((prev) => !prev)}
                className="relative flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border)] text-[var(--text-soft)] hover:bg-[var(--surface-soft)] hover:text-[var(--text-main)] transition-colors"
                aria-label="View notifications"
              >
                <BellIcon size={16} />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-bold text-white shadow-xs">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </button>

              {/* Notification Popover */}
              {notificationsOpen && (
                <div
                  className="absolute right-0 top-full mt-2 w-80 sm:w-96 rounded-xl border border-[var(--border)] bg-[var(--surface-strong,#ffffff)] p-3 shadow-xl z-50 animate-in fade-in zoom-in-95 duration-100"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center justify-between border-b border-[var(--border)] pb-2 mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-[var(--text-main)]">Notifications</span>
                      {unreadCount > 0 && (
                        <span className="rounded-full bg-[var(--accent)]/10 px-2 py-0.5 text-[10px] font-bold text-[var(--accent)]">
                          {unreadCount} new
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <button
                        type="button"
                        onClick={markAllRead}
                        className="text-[var(--accent)] hover:underline font-medium"
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

                  <div className="max-h-72 overflow-y-auto space-y-1.5 pr-1">
                    {items.length === 0 ? (
                      <p className="py-6 text-center text-xs text-[var(--text-soft)]">No notifications right now.</p>
                    ) : (
                      items.slice(0, 10).map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => {
                            markRead(item.id);
                            setNotificationsOpen(false);
                            if (item.href) router.push(item.href);
                          }}
                          className={`w-full rounded-lg border p-2.5 text-left text-xs transition-colors ${
                            item.read
                              ? "border-transparent hover:bg-[var(--surface-soft)] text-[var(--text-soft)]"
                              : "border-[var(--border)] bg-[var(--accent)]/5 text-[var(--text-main)]"
                          }`}
                        >
                          <p className="font-semibold">{item.title}</p>
                          <p className="mt-0.5 text-[11px] text-[var(--text-soft)] line-clamp-2">{item.message}</p>
                          <p className="mt-1 text-[10px] text-[var(--text-faint)]">
                            {new Date(item.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </p>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Mobile Avatar Menu */}
            <div className="md:hidden relative">
              <button
                type="button"
                onClick={() => setProfileMenuOpen((prev) => !prev)}
                className="flex rounded-full ring-2 ring-transparent transition hover:ring-[var(--accent)]"
                aria-label="User profile"
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

              {profileMenuOpen && renderProfileMenu("mobile")}
            </div>
          </div>
        </header>

        {/* ── EXPANDABLE MOBILE SEARCH BAR ────────────────────────────────────── */}
        {mobileSearchOpen && (
          <div className="flex sm:hidden items-center px-3 py-2 bg-[var(--surface-strong,#ffffff)] border-b border-[var(--border)] gap-2 animate-in fade-in duration-100 z-20">
            <div className="relative flex-1">
              <SearchIcon size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-soft)]" />
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
                className="h-8 w-full rounded-md border border-[var(--border)] bg-[var(--surface-soft)] pl-8 pr-3 text-xs text-[var(--text-main)] outline-none focus:border-[var(--accent)]"
              />
            </div>
            <button
              type="button"
              onClick={() => setMobileSearchOpen(false)}
              className="text-xs font-semibold text-[var(--text-soft)] px-1"
            >
              Cancel
            </button>
          </div>
        )}

        {/* ── MOBILE DRAWER NAVIGATION ────────────────────────────────────────── */}
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-50 flex md:hidden">
            <div
              className="fixed inset-0 bg-black/40 backdrop-blur-xs"
              onClick={() => setMobileMenuOpen(false)}
            />
            <div className="relative flex w-64 max-w-[80vw] flex-col bg-[var(--surface-strong,#ffffff)] p-4 shadow-xl z-10 border-r border-[var(--border)]">
              <div className="flex items-center gap-2 border-b border-[var(--border)] pb-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--accent)] text-white font-bold text-xs">
                  P
                </div>
                <div>
                  <p className="text-sm font-bold text-[var(--text-main)]">Planitt CRM</p>
                  <p className="text-[10px] text-[var(--text-soft)]">{roleLabels[user.role]}</p>
                </div>
              </div>

              <nav className="mt-4 flex-1 space-y-1">
                {navItems.map((item) => {
                  const isActive = pathname === item.href;
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`flex items-center gap-3 rounded-lg px-3 py-2 text-xs font-semibold ${
                        isActive
                          ? "bg-[var(--accent)] text-white"
                          : "text-[var(--text-main)] hover:bg-[var(--surface-soft)]"
                      }`}
                    >
                      <Icon size={16} />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </nav>

              <div className="border-t border-[var(--border)] pt-3">
                <button
                  type="button"
                  onClick={handleLogout}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                >
                  <LogOutIcon size={15} />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── CONTENT BODY VIEWPORT ─────────────────────────────────────────── */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden p-3 sm:p-5 lg:p-6">
          <div className="mx-auto max-w-7xl w-full">
            {children}
          </div>
        </main>

        {/* ── MOBILE BOTTOM NAVIGATION BAR ─────────────────────────────────────── */}
        <nav
          className="flex md:hidden h-14 shrink-0 items-center justify-around border-t border-[var(--border)] bg-[var(--surface-strong,#ffffff)] px-2 z-20"
          aria-label="Mobile Navigation"
        >
          {navItems.slice(0, 5).map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center justify-center gap-0.5 px-3 py-1 text-[10px] font-medium transition-colors ${
                  isActive ? "text-[var(--accent)] font-bold" : "text-[var(--text-soft)] hover:text-[var(--text-main)]"
                }`}
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
