type ToastType =
  | "success"
  | "error"
  | "info";

export function showToast(
  message: string,
  type: ToastType =
    "info"
) {
  window.dispatchEvent(
    new CustomEvent(
      "crm-toast",
      {
        detail: {
          message,
          type,
        },
      }
    )
  );
} 