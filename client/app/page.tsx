import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Planitt CRM — Sales & team operations",
  description:
    "Planitt CRM is an internal SaaS workspace for sales follow-ups, task management, attendance, and team workflows. Sign in to access your organization.",
  openGraph: {
    title: "Planitt CRM",
    description: "Internal CRM for sales, follow-ups, and team workflows.",
  },
};

/**
 * Public landing page (no auth). Required for Google OAuth consent screen
 * "Application home page" verification — the URL must be viewable without login.
 */
export default function HomePage() {
  return (
    <div
      className="min-h-screen w-full px-4 py-12 text-[var(--text-main)] sm:px-6 sm:py-16"
      style={{
        background:
          "radial-gradient(circle at top, color-mix(in srgb, var(--accent) 20%, transparent), transparent 32%), linear-gradient(180deg, var(--app-bg) 0%, var(--app-bg-accent) 100%)",
      }}
    >
      <div className="mx-auto max-w-2xl">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--text-faint)]">Planitt CRM</p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Sales &amp; team operations workspace</h1>
        <p className="mt-4 text-base leading-relaxed text-[var(--text-soft)] sm:text-lg">
          Planitt CRM is a web application operated by PLANITT SOLUTIONS PVT LTD. It helps organizations run internal
          customer relationship management: employee and intern management, departments, projects, tasks, attendance,
          chat, and leadership dashboards. Access to the product requires an account issued by your organization&apos;s
          administrator.
        </p>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <Link
            href="/login"
            className="inline-flex h-12 items-center justify-center rounded-2xl bg-[var(--accent-strong)] px-6 text-sm font-semibold text-white shadow-sm transition hover:opacity-95"
          >
            Sign in
          </Link>
          <Link
            href="/privacy-policy"
            className="inline-flex h-12 items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-6 text-sm font-semibold text-[var(--text-main)] transition hover:bg-[var(--surface-soft)]"
          >
            Privacy Policy
          </Link>
          <Link
            href="/terms-of-service"
            className="inline-flex h-12 items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-6 text-sm font-semibold text-[var(--text-main)] transition hover:bg-[var(--surface-soft)]"
          >
            Terms of Service
          </Link>
        </div>

        <p className="mt-10 text-sm text-[var(--text-faint)]">
          Signed-in users are redirected to the dashboard after authentication. This page is public so visitors can
          understand what the application is before signing in.
        </p>
      </div>
    </div>
  );
}
