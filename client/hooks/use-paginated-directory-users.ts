"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apiGet } from "@/lib/api";
import type { CRMUser, UserRole } from "@/types/crm";

type PaginatedUsers = { items: CRMUser[]; total: number; hasMore: boolean; nextOffset: number };

function useDebouncedValue(value: string, delayMs: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(id);
  }, [value, delayMs]);
  return debounced;
}

export type UserDirectoryStats = {
  total: number;
  employees: number;
  interns: number;
  leadership: number;
  departmentCoverage: number;
};

type UsePaginatedDirectoryUsersOptions = {
  limit?: number;
  roleFilter: "ALL" | UserRole;
  searchQuery: string;
  enabled: boolean;
};

function usersListUrl(limit: number, offset: number, debouncedSearch: string, roleFilter: "ALL" | UserRole) {
  const params = new URLSearchParams({
    paginate: "true",
    limit: String(limit),
    offset: String(offset),
  });
  if (debouncedSearch) {
    params.set("q", debouncedSearch);
  }
  if (roleFilter !== "ALL") {
    params.set("roles", roleFilter);
  }
  return `/users?${params.toString()}`;
}

function mergeById(existing: CRMUser[], incoming: CRMUser[]) {
  const map = new Map<string, CRMUser>();
  for (const u of existing) {
    map.set(u.id, u);
  }
  for (const u of incoming) {
    map.set(u.id, u);
  }
  return [...map.values()];
}

/** Server-backed directory slice + search (`q`). Pair with MemberPickerToolbar + Load more. */
export function usePaginatedDirectoryUsers({
  limit = 18,
  roleFilter,
  searchQuery,
  enabled,
}: UsePaginatedDirectoryUsersOptions) {
  const debouncedSearch = useDebouncedValue(searchQuery.trim(), 320);
  const [items, setItems] = useState<CRMUser[]>([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [nextOffset, setNextOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const nextOffsetRef = useRef(0);

  const queryKey = useMemo(
    () => `${debouncedSearch}\0${roleFilter}\0${limit}`,
    [debouncedSearch, roleFilter, limit]
  );

  useEffect(() => {
    nextOffsetRef.current = nextOffset;
  }, [nextOffset]);

  useEffect(() => {
    if (!enabled) {
      return;
    }
    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
        const data = await apiGet<PaginatedUsers>(usersListUrl(limit, 0, debouncedSearch, roleFilter));
        
        if (cancelled) {
          return;
        }
        setItems(data.items);
        setTotal(data.total);
        setHasMore(data.hasMore);
        setNextOffset(data.nextOffset);
        nextOffsetRef.current = data.nextOffset;
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled, queryKey, debouncedSearch, roleFilter, limit]);

  const loadMore = useCallback(async () => {
    if (!enabled || !hasMore || loadingMore) {
      return;
    }
    setLoadingMore(true);
    try {
      const offset = nextOffsetRef.current;
      const data = await apiGet<PaginatedUsers>(usersListUrl(limit, offset, debouncedSearch, roleFilter));
      setItems((prev) => mergeById(prev, data.items));
      setHasMore(data.hasMore);
      setNextOffset(data.nextOffset);
      nextOffsetRef.current = data.nextOffset;
    } finally {
      setLoadingMore(false);
    }
  }, [enabled, hasMore, loadingMore, limit, debouncedSearch, roleFilter]);

  return {
    items,
    total,
    hasMore,
    loading,
    loadingMore,
    loadMore,
  };
}

export async function fetchUserDirectoryStats(): Promise<UserDirectoryStats> {
  return apiGet<UserDirectoryStats>("/users/directory-stats");
}
