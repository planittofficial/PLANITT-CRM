"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { setToken } from "@/lib/auth";
import { resolveApiBaseUrl } from "@/lib/api";
import { normalizeLoginEmail } from "@/lib/normalize-email";
import { parseApiJsonBody } from "@/lib/parse-api-response";
import { showToast } from "@/hooks/use-toast";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const GOOGLE_FRIENDLY_ERROR = "Unable to continue with Google login right now. Please try again in a moment.";

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const query = new URLSearchParams(window.location.search);
    const queryState = query.get("google");
    const token = query.get("token");
    const state = queryState;

    if (state === "connected") {
      if (token) {
        setToken(token);
      }
      window.history.replaceState({}, document.title, "/login");
      router.push("/dashboard");
      return;
    }

    if (state === "user_not_found") {
      showToast("Google account is not registered in CRM yet. Ask admin to create your user first." , "error");
    } else if (state === "denied") {
      showToast("Google login was cancelled." , "error");
    } else if (
      state === "missing_config" ||
      state === "token_failed" ||
      state === "failed" ||
      state === "missing_code" ||
      state === "email_missing"
    ) {
      showToast(GOOGLE_FRIENDLY_ERROR , "error");
    }
  }, [router]);

  const handleLogin = async () => {
    try {
      setLoading(true);
      setError("");

      const normalizedEmail = normalizeLoginEmail(email);
      if (!normalizedEmail || !password) {
        showToast("Enter your email and password." , "error");
        return;
      }

      const res = await fetch(`${resolveApiBaseUrl()}/auth/login`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: normalizedEmail, password }),
      });

      const { json, rawSnippet } = await parseApiJsonBody(res);
      const message =
        typeof json?.error === "string"
          ? json.error
          : !res.ok && rawSnippet
            ? `Server returned an unexpected response (${res.status}). Check NEXT_PUBLIC_API_URL and that the API is running.`
            : res.status === 429
              ? "Too many login attempts. Please wait a few minutes and try again."
              : "Login failed";

      if (!res.ok) {
        throw new Error(message);
      }

      if (typeof json?.token === "string" && json.token.length > 0) {
        setToken(json.token);
      }
      router.push("/dashboard");
    } catch (err) {
      if (err instanceof TypeError && err.message.toLowerCase().includes("fetch")) {
        setError(
          `Cannot reach the API. Confirm the backend is running and NEXT_PUBLIC_API_URL points to it (${resolveApiBaseUrl()}).`
        );
      } else {
        showToast(err instanceof Error ? err.message : "Login failed" , "error");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      setGoogleLoading(true);
      setError("");

      const res = await fetch(`${resolveApiBaseUrl()}/auth/google/auth-url`, {
        credentials: "include",
      });
      const data = await res.json();

      if (!res.ok || !data.authUrl) {
        throw new Error("google_auth_start_failed");
      }

      window.location.href = data.authUrl;
    } catch (_err) {
      showToast(GOOGLE_FRIENDLY_ERROR , "error");
      setGoogleLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen w-full overflow-x-hidden px-3 py-6 sm:px-4 sm:py-10"
      style={{
        background:
          "radial-gradient(circle at top, color-mix(in srgb, var(--accent) 24%, transparent), transparent 28%), linear-gradient(180deg, var(--app-bg) 0%, var(--app-bg-accent) 100%)",
      }}
    >
      <div className="mx-auto grid min-h-[calc(100dvh-3rem)] max-w-6xl items-center gap-6 sm:gap-8 md:min-h-[calc(100vh-5rem)] lg:grid-cols-[1.1fr_0.9fr]">
        <section
          className="rounded-[28px] border p-6 text-white shadow-[0_30px_120px_rgba(15,23,42,0.35)] sm:rounded-[36px] sm:p-8 lg:p-12"
          style={{
            background: "linear-gradient(165deg, #0f172a 0%, #020617 100%)",
            borderColor: "rgba(255,255,255,0.12)",
          }}
        >
          <div className="inline-flex rounded-full border border-white/10 bg-white/10 px-3 py-1 text-[10px] uppercase tracking-[0.24em] text-slate-300 sm:text-xs">
            Modern CRM Workspace
          </div>
          <h1 className="mt-6 max-w-2xl text-3xl font-semibold leading-tight sm:mt-8 sm:text-4xl lg:text-6xl">
            Run sales, people, and daily operations from one simple dashboard.
          </h1>
          <p className="mt-4 max-w-xl text-sm leading-7 text-slate-300 sm:mt-6 sm:text-base">
            Admins can manage employees, interns, and task allocation. Team members get a clean daily workspace focused on execution.
          </p>

          <div className="mt-8 grid gap-3 sm:mt-10 sm:grid-cols-3 sm:gap-4">
            {[
              { label: "Role-based access", value: "Admin / Employee / Intern" },
              { label: "Task tracking", value: "Create, assign, update" },
              { label: "Daily workflow", value: "Attendance + execution" },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-2xl border border-white/10 bg-white/5 p-3 sm:rounded-3xl sm:p-4"
              >
                <p className="text-xs uppercase tracking-[0.22em] text-slate-400">{item.label}</p>
                <p className="mt-3 text-sm font-medium text-white">{item.value}</p>
              </div>
            ))}
          </div>
        </section>

        <section
          className="rounded-[28px] border p-6 shadow-[0_30px_120px_rgba(15,23,42,0.14)] backdrop-blur sm:rounded-[36px] sm:p-8 lg:p-10"
          style={{
            background: "color-mix(in srgb, var(--surface-strong) 88%, transparent)",
            borderColor: "var(--border)",
          }}
        >
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--text-faint)] sm:text-sm">
            Planitt CRM
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-[var(--text-main)] sm:mt-4 sm:text-4xl">
            Login
          </h2>
          <p className="mt-2 text-sm leading-6 text-[var(--text-soft)] sm:mt-3">
            Use the seeded admin or employee account to explore the CRM experience.
          </p>

          <form
            className="mt-6 space-y-4 sm:mt-8"
            onSubmit={(e) => {
              e.preventDefault();
              void handleLogin();
            }}
          >
            <input
              suppressHydrationWarning
              className="h-12 w-full rounded-2xl border px-4 text-[var(--text-main)] outline-none transition placeholder:text-[var(--text-faint)] sm:h-14"
              style={{
                borderColor: "var(--border)",
                background: "var(--surface-soft)",
              }}
              placeholder="Email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />

            <input
              suppressHydrationWarning
              className="h-12 w-full rounded-2xl border px-4 text-[var(--text-main)] outline-none transition placeholder:text-[var(--text-faint)] sm:h-14"
              style={{
                borderColor: "var(--border)",
                background: "var(--surface-soft)",
              }}
              type="password"
              placeholder="Password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />

            {error ? <p className="text-sm font-medium text-[var(--danger)]">{error}</p> : null}

            <button
              suppressHydrationWarning
              type="submit"
              className="h-12 w-full rounded-2xl text-sm font-semibold text-white transition hover:opacity-95 disabled:cursor-wait disabled:opacity-70 sm:h-14"
              style={{ background: "var(--accent-strong)" }}
              disabled={loading}
            >
              {loading ? "Logging in..." : "Enter workspace"}
            </button>
          </form>

          <button
            suppressHydrationWarning
            type="button"
            onClick={handleGoogleLogin}
            className="mt-3 h-12 w-full rounded-2xl border text-sm font-semibold transition hover:opacity-95 disabled:cursor-wait disabled:opacity-70 sm:h-14"
            style={{
              borderColor: "var(--border)",
              background: "var(--surface)",
              color: "var(--text-main)",
            }}
            disabled={googleLoading}
          >
            {googleLoading ? "Redirecting to Google..." : "Login with Google"}
          </button>

          <nav
            className="mt-8 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 border-t pt-6 text-sm"
            style={{ borderColor: "var(--border)" }}
            aria-label="Legal"
          >
            <Link
              href="/privacy-policy"
              className="font-medium text-[var(--text-soft)] underline-offset-4 transition hover:text-[var(--accent)] hover:underline"
            >
              Privacy Policy
            </Link>
            <span className="text-[var(--text-faint)]" aria-hidden>
              ·
            </span>
            <Link
              href="/terms-of-service"
              className="font-medium text-[var(--text-soft)] underline-offset-4 transition hover:text-[var(--accent)] hover:underline"
            >
              Terms of Service
            </Link>
          </nav>
        </section>
      </div>
    </div>
  );
}
