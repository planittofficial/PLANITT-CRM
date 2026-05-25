"use client";

import { StatePanel } from "@/components/shared/state-panel";
import { LoadingSkeleton } from "@/components/shared/loading-skeleton";

type SessionGateProps = {
  loading: boolean;
  user: unknown;
  error: string;
  retry: () => void;
  loadingTitle?: string;
  loadingDescription?: string;
};

/**
 * Returns a blocking panel while the session loads, on connection failure, or while redirecting after auth loss.
 */
export function renderSessionGate({
  loading,
  user,
  error,
  retry,
  loadingTitle = "Loading",
  loadingDescription = "Please wait.",
}: SessionGateProps) {
  if (loading) {
    return <LoadingSkeleton title={loadingTitle} subtitle={loadingDescription} blocks={6} />;
  }

  if (!user) {
    if (error) {
      return (
        <StatePanel
          title="Connection problem"
          description={error}
          actions={
            <button
              type="button"
              className="rounded-lg px-4 py-2 text-sm font-semibold text-white transition hover:opacity-95"
              style={{ background: "var(--accent-strong)" }}
              onClick={retry}
            >
              Try again
            </button>
          }
        />
      );
    }

    return <LoadingSkeleton title={loadingTitle} subtitle={loadingDescription} blocks={4} />;
  }

  return null;
}
