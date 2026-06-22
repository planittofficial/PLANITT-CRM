"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { apiGet, apiPost } from "@/lib/api";
import { clearToken } from "@/lib/auth";
import {
 showToast
}
from
"@/hooks/use-toast";
import { useCrmSearch } from "@/components/providers/crm-search-provider";
import { useTheme } from "@/components/providers/theme-provider";
import { useNotificationsBackend } from "@/hooks/use-notifications-backend";
import { migrateLegacyThemeKeys } from "@/lib/theme-storage";
import type { CRMUser, DashboardSummary, EmployeeDashboardSummary } from "@/types/crm";

type CRMShellProps = {
  children: React.ReactNode;
  user: CRMUser;
  /** Hides the in-page title/search bar on mobile to maximize content area (e.g. chat). */
  compactMobileChrome?: boolean;
};

type NavItem = {
  href: string;
  label: string;
  icon: string;
};

const roleLabel: Record<CRMUser["role"], string> = {
  SUPERADMIN: "CEO",
  ADMIN: "Admin",
  MANAGER: "Manager",
  EMPLOYEE: "Employee",
  INTERN: "Intern",
};

const pageTitles: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/analytics": "Analytics & Reports",
  "/projects": "Projects",
  "/tasks": "Tasks",
  "/leaves": "Leaves",
  "/employees": "Employees",
  "/departments": "Departments",
  "/logs": "Logs",
  "/chat": "Chats",
  "/settings": "Settings",
  "/notifications": "Notifications",
};

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function UserAvatar({
  name,
  avatarUrl,
  authProvider,
  className,
}: {
  name: string;
  avatarUrl?: string | null;
  authProvider?: CRMUser["authProvider"];
  className: string;
}) {
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
        className={`block ${className} object-cover`}
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

function CRMShellHeaderSearch() {
  const { globalSearch, setGlobalSearch , submitSearch ,searchNoResult ,setSearchNoResult} = useCrmSearch();
  const router = useRouter();

  useEffect(() => {
    if (!searchNoResult) return;
    const timer = window.setTimeout(() => setSearchNoResult(false), 2200);
    return () => window.clearTimeout(timer);
  }, [searchNoResult, setSearchNoResult]);
  

  return (
    <label className="relative block w-full min-w-0">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-[var(--text-faint)]">
        Search
      </span>
      <input
  aria-label="Search CRM"
  type="search"
  value={globalSearch}
  onChange={(event) =>
    {
      setGlobalSearch(event.target.value);
      if (searchNoResult) {
        setSearchNoResult(false);
      }
    }
  }
  onKeyDown={(event) => {
  if (event.key !== "Enter") return;

  event.preventDefault();

  submitSearch();

  const q = globalSearch.trim().toLowerCase();

  if (!q) return;

  const page = Object.entries(pageTitles).find(
    ([, label]) =>
      label.toLowerCase() === q
  );

  if (page) {
  router.push(page[0]);
} else {
  setSearchNoResult(true);
}
}}
  className="crm-input h-10 w-full min-w-0 rounded-md pl-16 pr-3 text-sm sm:w-72"
  placeholder="Search anything..."
/>
{searchNoResult && (
  <span
    className="
      absolute
      left-0
      top-full
      mt-1
      text-xs
      text-red-500
    "
  >
    No matching results
  </span>
)}
    </label>
  );
}

export function CRMShell({ children, user, compactMobileChrome = false }: CRMShellProps) {
  
  const { globalSearch } = useCrmSearch();
  const pathname = usePathname();
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  
  const {
    items = [],
    unreadCount = 0,
    lastPushedId = "",
    markAllRead,
    markRead,
    clearAll,
  } = useNotificationsBackend(user);
  
  const [toastVisible, setToastVisible] = useState(false);
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [checkedIn, setCheckedIn] = useState(false);

  const latestItem = useMemo(() => items[0] ?? null, [items]);

  useEffect(() => {
    if (!lastPushedId) {
      return;
    }
    setToastVisible(true);
    const timer = setTimeout(() => setToastVisible(false), 3200);
    return () => clearTimeout(timer);
  }, [lastPushedId]);

  const canUseAttendanceQuickAction =
    user.role === "SUPERADMIN" || user.role === "ADMIN" || user.role === "MANAGER";

  useEffect(() => {
    if (!canUseAttendanceQuickAction) {
      return;
    }

    const syncAttendanceState = async () => {
      try {
        const summary = await apiGet<DashboardSummary>("/dashboard/summary");
        const currentCheckedIn =
          summary.scope === "employee"
            ? (summary as EmployeeDashboardSummary).metrics.checkedIn
            : summary.metrics.checkedIn;
        setCheckedIn(Boolean(currentCheckedIn));
      } catch {
        setCheckedIn(false);
      }
    };


    void syncAttendanceState();

    const onAttendanceUpdated = () => {
      void syncAttendanceState();
    };

    window.addEventListener("attendance:local-updated", onAttendanceUpdated);
    return () => {
      window.removeEventListener("attendance:local-updated", onAttendanceUpdated);
    };
  }, [canUseAttendanceQuickAction]);

  const handleAttendanceQuickAction = async () => {
    try {
      setAttendanceLoading(true);
      if (checkedIn) {
        await apiPost("/attendance/checkout");
        setCheckedIn(false);
        showToast(
        "Checked out successfully.",
        "success"
      );
      } else {
        await apiPost("/attendance/checkin");
        setCheckedIn(true);
        showToast(
        "Checked in successfully.",
        "success"
      );

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

  const navItems: NavItem[] = [
    { href: "/dashboard", label: "Dashboard", icon: "D" },
    ...(user.role === "SUPERADMIN" || user.role === "ADMIN" || user.role === "MANAGER"
      ? [{ href: "/analytics", label: "Analytics", icon: "A" }]
      : []),
    ...(user.role === "SUPERADMIN" || user.role === "ADMIN" || user.role === "MANAGER"
      ? [{ href: "/projects", label: "Projects", icon: "P" }]
      : []),
    { href: "/tasks", label: "Tasks", icon: "T" },
    { href: "/leaves", label: "Leaves", icon: "L" },
    ...(user.role === "SUPERADMIN" || user.role === "ADMIN" || user.role === "MANAGER"
      ? [{ href: "/employees", label: "Employees", icon: "E" }]
      : []),
    ...(user.role === "SUPERADMIN" || user.role === "ADMIN"
      ? [{ href: "/departments", label: "Departments", icon: "O" }]
      : []),
    ...(user.role === "SUPERADMIN" || user.role === "ADMIN"
      ? [{ href: "/logs", label: "Logs", icon: "L" }]
      : []),
    { href: "/chat", label: "Chats", icon: "C" },
    { href: "/settings", label: "Settings", icon: "S" },
  ];

  const handleLogout = async () => {
    try {
      await apiPost<void>("/auth/logout");
    } catch {
      // Client state is still cleared even if logout endpoint is temporarily unavailable.
    }
    clearToken();
    router.replace("/login");
  };
  

  useEffect(() => {
    migrateLegacyThemeKeys(user.id);
  }, [user.id]);

  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

  const toggleTheme = () => {
    setTheme(theme === "light" ? "dark" : "light");
  };

  const pageTitle = pageTitles[pathname] ?? (pathname.startsWith("/leaves") ? "Leaves" : "CRM");

  return (
    <div
      className="min-h-screen min-w-0 overflow-x-clip text-[var(--text-main)] lg:h-screen lg:overflow-hidden"
      style={{
        background:
          "linear-gradient(135deg, color-mix(in srgb, var(--app-bg) 92%, white), var(--app-bg-accent))",
      }}
    >
      <header
        className="fixed left-0 right-0 top-0 z-40 flex h-14 items-center justify-between gap-3 border-b px-3 shadow-sm lg:hidden"
        style={{
          background: "var(--surface-strong)",
          borderColor: "var(--border)",
        }}
      >
        <div className="flex min-w-0 items-center gap-2">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-sm font-black text-white">
            P
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-[var(--text-main)]">Planitt CRM</p>
            <p className="truncate text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--text-faint)]">
              {pageTitle}
            </p>
          </div>
        </div>
        <button
          type="button"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border text-[var(--text-main)]"
          style={{ borderColor: "var(--border)", background: "var(--surface-soft)" }}
          aria-expanded={mobileNavOpen}
          aria-label={mobileNavOpen ? "Close navigation" : "Open navigation"}
          onClick={() => setMobileNavOpen((open) => !open)}
        >
          {mobileNavOpen ? (
            <span className="text-lg font-light leading-none">×</span>
          ) : (
            <span className="flex flex-col gap-1" aria-hidden>
              <span className="block h-0.5 w-5 rounded-full bg-current" />
              <span className="block h-0.5 w-5 rounded-full bg-current" />
              <span className="block h-0.5 w-5 rounded-full bg-current" />
            </span>
          )}
        </button>
      </header>

      {mobileNavOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/45 lg:hidden"
          aria-label="Close menu"
          onClick={() => setMobileNavOpen(false)}
        />
      ) : null}

      <div className="flex min-h-screen flex-col gap-2 px-2 pb-3 pt-[calc(3.75rem+var(--crm-safe-top))] sm:gap-3 sm:px-3 sm:py-3 lg:h-screen lg:flex-row lg:gap-0 lg:overflow-hidden lg:px-0 lg:pb-0 lg:pt-0">
        <aside
          className={`fixed bottom-0 left-0 top-14 z-50 w-[min(288px,90vw)] overflow-hidden rounded-r-lg border px-3 py-3 shadow-xl transition-transform duration-200 ease-out lg:relative lg:top-0 lg:z-30 lg:h-full lg:w-[240px] lg:shrink-0 lg:rounded-none lg:border-b-0 lg:border-l-0 lg:border-r lg:border-t-0 lg:shadow-none lg:transition-none ${
            mobileNavOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
          }`}
          style={{
            background: theme === "dark"
              ? "linear-gradient(180deg, #071120 0%, #0b1626 100%)"
              : "linear-gradient(180deg, #356bff 0%, #063ce9 100%)",
            borderColor: "rgba(255,255,255,0.14)",
            color: "#f8fafc",
            boxShadow: theme === "dark"
              ? "0 18px 44px rgba(0,0,0,0.34)"
              : "0 18px 44px rgba(31,85,255,0.25)",
          }}
        >
          <div className="flex h-full flex-col">
            <div>
              <div className="flex items-center gap-2 px-1 py-1">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white text-sm font-black text-blue-600">
                  P
                </div>
                <div>
                  <p className="text-sm font-bold leading-none text-white">Planitt CRM</p>
                  <p className="mt-1 text-[10px] font-medium uppercase tracking-[0.16em] text-white/55">
                    CRM Pro
                  </p>
                </div>
              </div>
            </div>

            <nav className="mt-6 space-y-1">
              {navItems.map((item) => {
                const isActive = pathname === item.href;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileNavOpen(false)}
                    className={`flex items-center gap-3 rounded-md px-3 py-2.5 text-[13px] font-semibold transition ${
                      isActive ? "bg-white text-blue-700 shadow-sm" : "text-white/78 hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    <span
                      className={`flex h-5 w-5 items-center justify-center rounded text-[10px] font-black ${
                        isActive ? "bg-blue-600 text-white" : "bg-white/10 text-white/80"
                      }`}
                    >
                      {item.icon}
                    </span>
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>

            <div className="mt-auto rounded-lg border border-white/12 bg-white/8 p-3">
              <div className="flex items-center gap-3">
                <UserAvatar
                  name={user.name}
                  avatarUrl={user.avatarUrl}
                  authProvider={user.authProvider}
                  className="crm-avatar h-9 w-9 rounded-full text-xs"
                />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-white">{user.name}</p>
                  <p className="text-xs text-white/60">{roleLabel[user.role]}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={toggleTheme}
                className="mt-3 flex w-full items-center justify-between rounded-md border border-white/10 bg-white/7 px-3 py-2 text-xs font-semibold text-white/80 transition hover:bg-white/12"
              >
                <span>{theme === "light" ? "Light" : "Dark"} mode</span>
                <span>Switch</span>
              </button>
              <button
                type="button"
                onClick={handleLogout}
                className="mt-2 w-full rounded-md bg-white px-3 py-2 text-xs font-bold text-slate-950 transition hover:bg-slate-100"
              >
                Log out
              </button>
            </div>
          </div>
        </aside>

        <main className="min-h-0 min-w-0 flex-1 overflow-x-hidden lg:flex lg:h-full lg:flex-col lg:overflow-hidden lg:p-3">
          <header
            className={`mb-2 flex shrink-0 flex-col gap-3 rounded-lg border px-3 py-3 sm:mb-3 sm:px-4 md:flex-row md:items-center md:justify-between ${
              compactMobileChrome ? "hidden lg:flex" : ""
            }`}
            style={{
              background: "var(--surface)",
              borderColor: "var(--border)",
              boxShadow: "var(--shadow-card)",
            }}
          >
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-faint)]">
                CRM Pro
              </p>
              <h1 className="mt-1 text-xl font-bold text-[var(--text-main)]">{pageTitle}</h1>
            </div>
            <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center md:justify-end">
              <CRMShellHeaderSearch />
              <div className="flex min-w-0 flex-wrap items-center gap-2 sm:justify-end">
                {canUseAttendanceQuickAction ? (
                  <button
                    type="button"
                    onClick={() => void handleAttendanceQuickAction()}
                    disabled={attendanceLoading}
                    className="flex h-10 min-w-0 items-center justify-center rounded-md border px-3 text-xs font-bold transition disabled:cursor-wait disabled:opacity-70"
                    style={{
                      borderColor: "var(--border)",
                      background: checkedIn ? "var(--danger)" : "var(--accent)",
                      color: "white",
                    }}
                  >
                    {attendanceLoading
                      ? "Please wait"
                      : checkedIn
                        ? "Check out"
                        : "Check in"}
                  </button>
                ) : null}
                <div className="relative min-w-0">
                  <button
                    type="button"
                    className="relative flex h-10 min-w-0 items-center justify-center gap-2 rounded-md border px-3 text-xs font-bold"
                    style={{ borderColor: "var(--border)", background: "var(--surface)", color: "var(--text-soft)" }}
                    aria-label="Notifications"
                    onClick={() => {
                      setNotificationsOpen((value) => !value);
                    }}
                  >
                    <svg
                      aria-hidden="true"
                      viewBox="0 0 24 24"
                      className="h-4 w-4"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M15 17h5l-1.4-1.4a2 2 0 0 1-.6-1.4V11a6 6 0 1 0-12 0v3.2a2 2 0 0 1-.6 1.4L4 17h5" />
                      <path d="M9 17a3 3 0 0 0 6 0" />
                    </svg>
                    <span>Alerts</span>
                    {unreadCount > 0 ? (
                      <span
                        className="absolute -right-1 -top-1 min-w-5 rounded-full px-1.5 py-0.5 text-[10px] font-bold text-white"
                        style={{ background: "var(--danger)" }}
                      >
                        {unreadCount > 9 ? "9+" : unreadCount}
                      </span>
                    ) : null}
                  </button>
                  {notificationsOpen ? (
                    <div
                      className="absolute right-0 z-50 mt-2 max-h-[min(70vh,32rem)] w-[min(360px,calc(100vw-1.25rem))] max-w-[calc(100vw-1.25rem)] overflow-hidden rounded-lg border p-3 sm:w-[min(360px,calc(100vw-2rem))] sm:max-w-[calc(100vw-2rem)]"
                      style={{
                        background: "var(--surface)",
                        borderColor: "var(--border)",
                        boxShadow: "var(--shadow-card)",
                      }}
                    >
                      <div className="mb-2 flex items-center justify-between">
                        <Link
                          href="/notifications"
                          className="text-sm font-semibold text-[var(--text-main)] hover:text-[var(--accent-strong)]"
                        >
                          Notifications
                        </Link>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={markAllRead}
                            className="text-xs font-semibold"
                            style={{ color: "var(--accent-strong)" }}
                          >
                            Mark read
                          </button>
                          <button
                            type="button"
                            onClick={clearAll}
                            className="text-xs font-semibold"
                            style={{ color: "var(--danger)" }}
                          >
                            Clear
                          </button>
                        </div>
                      </div>
                      <div className="max-h-[min(56vh,20rem)] space-y-2 overflow-y-auto pr-1">
                        {items.length === 0 ? (
                          <p className="rounded-md border px-3 py-4 text-xs" style={{ borderColor: "var(--border)", color: "var(--text-soft)" }}>
                            No notifications yet.
                          </p>
                        ) : (
                          items.slice(0, 8).map((item) => (
                            <button
                              key={item.id}
                              type="button"
                              className="w-full rounded-md border p-3 text-left"
                              style={{
                                borderColor: "var(--border)",
                                background: item.read ? "var(--surface)" : "var(--surface-soft)",
                              }}
                              onClick={() => {
                                markRead(item.id);
                                setNotificationsOpen(false);
                                router.push(item.href);
                              }}
                            >
                              <p className="text-sm font-semibold text-[var(--text-main)]">{item.title}</p>
                              <p className="mt-1 text-xs text-[var(--text-soft)]">{item.message}</p>
                              <div className="mt-2 flex items-center justify-between gap-2">
                                <span className="text-[10px] uppercase tracking-[0.14em] text-[var(--text-faint)]">
                                  {item.priority}
                                </span>
                                <span className="text-[10px] text-[var(--text-faint)]">
                                  {new Date(item.createdAt).toLocaleString()}
                                </span>
                              </div>
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  ) : null}
                </div>
                <UserAvatar
                  name={user.name}
                  avatarUrl={user.avatarUrl}
                  authProvider={user.authProvider}
                  className="crm-avatar h-10 w-10 rounded-full text-xs"
                />
              </div>
            </div>
          </header>
          {toastVisible && latestItem ? (
            <button
              type="button"
              className="mb-3 w-full rounded-lg border px-4 py-3 text-left"
              style={{ borderColor: "var(--border)", background: "var(--surface-soft)" }}
              onClick={() => {
                markRead(latestItem.id);
                setToastVisible(false);
                router.push(latestItem.href);
              }}
            >
              <p className="text-sm font-semibold text-[var(--text-main)]">{latestItem.title}</p>
              <p className="mt-1 text-xs text-[var(--text-soft)]">{latestItem.message}</p>
            </button>
          ) : null}
          <div
            className={`min-h-0 min-w-0 flex-1 overflow-x-hidden lg:flex lg:flex-col ${
              compactMobileChrome ? "overflow-hidden lg:overflow-y-auto" : "lg:overflow-y-auto"
            }`}
          >
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

