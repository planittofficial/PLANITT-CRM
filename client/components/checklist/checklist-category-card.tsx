"use client";

import { useState, type ChangeEvent } from "react";
import type { ChecklistCategoryDetail, ChecklistRecord, UserRole } from "@/types/crm";
import { apiPatch, apiPost, apiDelete } from "@/lib/api";
import { showToast } from "@/hooks/use-toast";

type CategoryCardProps = {
  category: ChecklistCategoryDetail;
  employeeId: string;
  currentUserRole: UserRole;
  onRefresh: () => void;
};

function formatDate(dateStr?: string | null) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function ChecklistCategoryCard({
  category,
  employeeId,
  currentUserRole,
  onRefresh,
}: CategoryCardProps) {
  const isSuperAdmin = currentUserRole === "SUPERADMIN";
  const [editingCategoryName, setEditingCategoryName] = useState(false);
  const [categoryName, setCategoryName] = useState(category.name);
  const [addingItem, setAddingItem] = useState(false);
  const [newItemName, setNewItemName] = useState("");
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [noteText, setNoteText] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const completionPercent =
    category.totalItems > 0
      ? Math.round((category.completedItems / category.totalItems) * 100)
      : 0;

  const handleToggle = async (item: ChecklistRecord) => {
    if (!item.id) return;
    const newStatus = item.status === "COMPLETED" ? "PENDING" : "COMPLETED";
    try {
      setBusy(item.id);
      await apiPatch(`/checklist/items/${item.id}`, { status: newStatus });
      onRefresh();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to update", "error");
    } finally {
      setBusy(null);
    }
  };

  const handleSaveNote = async (item: ChecklistRecord) => {
    if (!item.id) return;
    try {
      setBusy(item.id);
      await apiPatch(`/checklist/items/${item.id}`, { note: noteText });
      setEditingNoteId(null);
      onRefresh();
      showToast("Note saved", "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to save note", "error");
    } finally {
      setBusy(null);
    }
  };

  const handleRenameCategory = async () => {
    if (!categoryName.trim() || categoryName.trim() === category.name) {
      setEditingCategoryName(false);
      setCategoryName(category.name);
      return;
    }
    try {
      await apiPatch(`/checklist/categories/${category.id}`, { name: categoryName.trim() });
      setEditingCategoryName(false);
      onRefresh();
      showToast("Category renamed", "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to rename", "error");
    }
  };

  const handleDeleteCategory = async () => {
    if (!window.confirm(`Delete "${category.name}" and all its items? This cannot be undone.`)) {
      return;
    }
    try {
      await apiDelete(`/checklist/categories/${category.id}`);
      onRefresh();
      showToast("Category deleted", "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to delete", "error");
    }
  };

  const handleAddItem = async () => {
    if (!newItemName.trim()) return;
    try {
      await apiPost(`/checklist/categories/${category.id}/items`, {
        name: newItemName.trim(),
      });
      setNewItemName("");
      setAddingItem(false);
      onRefresh();
      showToast("Item added", "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to add item", "error");
    }
  };

  const handleDeleteItem = async (item: ChecklistRecord) => {
    if (!window.confirm(`Delete "${item.checklistItem.name}"? This cannot be undone.`)) {
      return;
    }
    try {
      await apiDelete(`/checklist/items/${item.checklistItem.id}`);
      onRefresh();
      showToast("Item deleted", "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to delete item", "error");
    }
  };

  return (
    <div
      className="rounded-2xl border transition-shadow hover:shadow-md"
      style={{
        background: "var(--surface)",
        borderColor: "var(--border)",
        boxShadow: "var(--shadow-card)",
      }}
    >
      {/* Category Header */}
      <div className="flex items-center justify-between border-b px-5 py-4" style={{ borderColor: "var(--border)" }}>
        <div className="flex min-w-0 items-center gap-3">
          {editingCategoryName && isSuperAdmin ? (
            <input
              autoFocus
              value={categoryName}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setCategoryName(e.target.value)}
              onBlur={handleRenameCategory}
              onKeyDown={(e) => e.key === "Enter" && handleRenameCategory()}
              className="crm-input h-8 rounded-lg px-2 text-sm font-semibold"
            />
          ) : (
            <h3
              className={`text-sm font-semibold text-[var(--text-main)] ${isSuperAdmin ? "cursor-pointer hover:text-[var(--accent-strong)]" : ""}`}
              onClick={() => isSuperAdmin && setEditingCategoryName(true)}
              title={isSuperAdmin ? "Click to rename" : undefined}
            >
              {category.name}
            </h3>
          )}
          <span className="text-xs text-[var(--text-faint)]">
            {category.completedItems}/{category.totalItems}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {isSuperAdmin ? (
            <>
              <button
                type="button"
                onClick={() => setAddingItem(true)}
                className="rounded-lg px-2.5 py-1.5 text-[10px] font-semibold transition hover:bg-[var(--surface-soft)]"
                style={{ color: "var(--accent-strong)" }}
              >
                + Item
              </button>
              <button
                type="button"
                onClick={handleDeleteCategory}
                className="rounded-lg px-2.5 py-1.5 text-[10px] font-semibold text-[var(--text-faint)] transition hover:text-red-500"
              >
                Delete
              </button>
            </>
          ) : null}
        </div>
      </div>

      {/* Progress Bar */}
      <div className="px-5 pt-3">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--border)]">
          <div
            className="h-full rounded-full transition-all duration-500 ease-out"
            style={{
              width: `${completionPercent}%`,
              background:
                completionPercent >= 100
                  ? "var(--success)"
                  : "linear-gradient(90deg, var(--accent), var(--accent-alt))",
            }}
          />
        </div>
      </div>

      {/* Items List */}
      <div className="divide-y px-2 py-2 sm:px-3" style={{ borderColor: "var(--border)" }}>
        {category.items.map((item) => {
          const isCompleted = item.status === "COMPLETED";
          const isBusy = busy === item.id;

          return (
            <div
              key={item.checklistItemId}
              className="flex flex-col gap-2 px-3 py-3 sm:flex-row sm:items-center sm:gap-4"
              style={{ borderColor: "var(--border)" }}
            >
              {/* Checkbox + Name */}
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <button
                  type="button"
                  onClick={() => handleToggle(item)}
                  disabled={isBusy}
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition ${
                    isCompleted
                      ? "border-[var(--success)] bg-[var(--success)]"
                      : "border-[var(--border)] hover:border-[var(--accent)]"
                  } ${isBusy ? "opacity-50" : ""}`}
                  aria-label={`Mark ${item.checklistItem.name} as ${isCompleted ? "pending" : "completed"}`}
                >
                  {isCompleted ? (
                    <svg className="h-3 w-3 text-white" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="2,6 5,9 10,3" />
                    </svg>
                  ) : null}
                </button>
                <span
                  className={`text-sm ${
                    isCompleted
                      ? "text-[var(--text-soft)] line-through"
                      : "font-medium text-[var(--text-main)]"
                  }`}
                >
                  {item.checklistItem.name}
                </span>
              </div>

              {/* Status + Meta */}
              <div className="flex flex-wrap items-center gap-2 pl-8 text-[10px] sm:gap-3 sm:pl-0">
                <span
                  className="inline-flex rounded-full px-2 py-0.5 font-semibold"
                  style={{
                    background: isCompleted
                      ? "color-mix(in srgb, var(--success) 14%, transparent)"
                      : "color-mix(in srgb, var(--warning) 14%, transparent)",
                    color: isCompleted ? "var(--success)" : "var(--warning)",
                  }}
                >
                  {isCompleted ? "Completed" : "Pending"}
                </span>
                {isCompleted && item.completedAt ? (
                  <span className="text-[var(--text-faint)]">{formatDate(item.completedAt)}</span>
                ) : null}
                {item.updatedBy ? (
                  <span className="text-[var(--text-faint)]">by {item.updatedBy.name}</span>
                ) : null}

                {/* Note */}
                {editingNoteId === item.id ? (
                  <div className="flex items-center gap-1">
                    <input
                      autoFocus
                      value={noteText}
                      onChange={(e: ChangeEvent<HTMLInputElement>) => setNoteText(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleSaveNote(item)}
                      className="crm-input h-6 w-36 rounded px-1.5 text-[10px]"
                      placeholder="Add a note..."
                    />
                    <button
                      type="button"
                      onClick={() => handleSaveNote(item)}
                      className="text-[10px] font-semibold"
                      style={{ color: "var(--accent-strong)" }}
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingNoteId(null)}
                      className="text-[10px] font-semibold text-[var(--text-faint)]"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <>
                    {item.note ? (
                      <span
                        className="max-w-[180px] cursor-pointer truncate italic text-[var(--text-soft)] hover:text-[var(--accent)]"
                        onClick={() => {
                          setEditingNoteId(item.id);
                          setNoteText(item.note ?? "");
                        }}
                        title={item.note}
                      >
                        {item.note}
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingNoteId(item.id);
                          setNoteText("");
                        }}
                        className="text-[10px] font-semibold text-[var(--text-faint)] hover:text-[var(--accent)]"
                      >
                        + Note
                      </button>
                    )}
                  </>
                )}

                {/* Super Admin: delete item */}
                {isSuperAdmin ? (
                  <button
                    type="button"
                    onClick={() => handleDeleteItem(item)}
                    className="text-[10px] font-semibold text-[var(--text-faint)] transition hover:text-red-500"
                    title="Delete item"
                  >
                    ×
                  </button>
                ) : null}
              </div>
            </div>
          );
        })}

        {/* Add item form */}
        {addingItem && isSuperAdmin ? (
          <div className="flex items-center gap-2 px-3 py-3">
            <input
              autoFocus
              value={newItemName}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setNewItemName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddItem()}
              className="crm-input h-8 flex-1 rounded-lg px-3 text-sm"
              placeholder="New item name..."
            />
            <button
              type="button"
              onClick={handleAddItem}
              className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-blue-500"
            >
              Add
            </button>
            <button
              type="button"
              onClick={() => { setAddingItem(false); setNewItemName(""); }}
              className="rounded-lg px-3 py-1.5 text-xs font-semibold text-[var(--text-faint)]"
            >
              Cancel
            </button>
          </div>
        ) : null}

        {category.items.length === 0 && !addingItem ? (
          <p className="px-3 py-4 text-center text-xs text-[var(--text-faint)]">
            No items in this category.{" "}
            {isSuperAdmin ? (
              <button
                type="button"
                onClick={() => setAddingItem(true)}
                className="font-semibold text-[var(--accent-strong)]"
              >
                Add one
              </button>
            ) : null}
          </p>
        ) : null}
      </div>
    </div>
  );
}
