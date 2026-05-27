"use client";

import {
  useEffect,
  useState,
} from "react";

type ToastData = {
  message: string;

  type:
    | "success"
    | "error"
    | "info";
};

export function Toast() {
  const [
    toast,
    setToast,
  ] =
    useState<
      ToastData | null
    >(null);

  useEffect(() => {
    function onToast(
      event: Event
    ) {
      const detail =
        (
          event as CustomEvent<ToastData>
        ).detail;

      setToast(detail);

      const timer =
        setTimeout(
          () => {
            setToast(
              null
            );
          },
          2500
        );

      return () =>
        clearTimeout(
          timer
        );
    }

    window.addEventListener(
      "crm-toast",
      onToast
    );

    return () => {
      window.removeEventListener(
        "crm-toast",
        onToast
      );
    };
  }, []);

  if (!toast)
    return null;

  return (
    <div
      className="
fixed
left-1/2
top-5
-z-0
translate-x-[-50%]

min-w-[260px]
max-w-[90vw]

rounded-2xl

px-5
py-3

text-center
text-sm
font-medium

text-white

shadow-xl

animate-[fadeIn_.2s]

backdrop-blur

transition-all
duration-300

z-[9999]
"
      style={{
 background:
  toast.type==="success"
   ? "#16a34a"
   : toast.type==="error"
   ? "#dc2626"
   : "#2563eb"
}}
    >
      {toast.message}
    </div>
  );
}