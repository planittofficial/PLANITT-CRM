"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

type CrmSearchContextValue = {
  globalSearch: string;
  searchSubmitted: boolean;
  searchNoResult: boolean;
  setGlobalSearch: (value: string) => void;
  setSearchNoResult: (value: boolean) => void;
  submitSearch: () => void;

  resetSearch: () => void;
};

const CrmSearchContext = createContext<CrmSearchContextValue | null>(null);

export function CrmSearchProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [globalSearch, setGlobalSearch] =
    useState("");
  const [searchSubmitted, setSearchSubmitted] =
  useState(false);
  const [
  searchNoResult,
  setSearchNoResult
] =
useState(false);
  function submitSearch() {
  setSearchSubmitted(true);
}

function resetSearch() {
  setSearchSubmitted(false);
}

  const value = useMemo(
  () => ({
    globalSearch,
    searchSubmitted,
    searchNoResult,
    setSearchNoResult,

    setGlobalSearch,

    submitSearch: () => {
      setSearchSubmitted(true);
      setSearchNoResult(false);
    },

    resetSearch: () => {
      setSearchSubmitted(false);
      setSearchNoResult(false);
    },
  }),
  [globalSearch, searchSubmitted, searchNoResult]
);
    return (
    <CrmSearchContext.Provider value={value}>
      {children}
    </CrmSearchContext.Provider>
  );
}

export function useCrmSearch() {
  const ctx = useContext(CrmSearchContext);
  if (!ctx) {
    throw new Error("useCrmSearch must be used within CrmSearchProvider");
  }
  return ctx;
}
