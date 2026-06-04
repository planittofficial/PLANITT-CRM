"use client";

import { type RefObject, type ReactNode } from "react";
import { showToast } from "@/hooks/use-toast";
import type { BulkUserUploadResult, CRMUser, Department, UserRole } from "@/types/crm";

const BULK_TEMPLATE = [
  "name,email,password,role,designation,department,managerEmail",
  "Aarav Sharma,aarav@planitt.com,TempPass@123,EMPLOYEE,Frontend Engineer,Engineering,manager@planitt.com",
  "Meera Singh,meera@planitt.com,TempPass@123,INTERN,Design Intern,Design,manager@planitt.com",
].join("\n");

const FIELD_STYLE = { borderColor: "var(--border)", background: "var(--surface-soft)", color: "var(--text-main)" } as const;

function Field({ children }: { children: ReactNode }) { return <div className="flex flex-col gap-3">{children}</div>; }
function Input({ ...props }: React.InputHTMLAttributes<HTMLInputElement>) { return <input className="h-11 w-full min-w-0 rounded-xl border px-3 text-sm outline-none sm:h-12 sm:rounded-2xl sm:px-4" style={FIELD_STYLE} {...props} />; }
function Select({ children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement> & { children: ReactNode }) { return <select className="h-11 w-full min-w-0 rounded-xl border px-3 text-sm outline-none sm:h-12 sm:rounded-2xl sm:px-4" style={FIELD_STYLE} {...props}>{children}</select>; }

export type CreateMemberForm = { name: string; email: string; password: string; role: UserRole; designation: string; departmentId: string; managerId: string };

type Props = {
  form: CreateMemberForm; onFormChange: (field: keyof CreateMemberForm, value: string) => void;
  creating: boolean; onSubmit: () => void; createRoleOptions: UserRole[];
  canBulkUpload: boolean; bulkFile: File | null; bulkUploading: boolean; bulkResult: BulkUserUploadResult | null;
  onBulkFileChange: (file: File | null) => void; onBulkUpload: () => void; onDownloadTemplate: () => void;
  bulkInputRef: RefObject<HTMLInputElement | null>; onSetError: (msg: string) => void;
  departments: Department[]; managers: CRMUser[];
};

export function CreateMemberPanel({ form, onFormChange, creating, onSubmit, createRoleOptions, canBulkUpload, bulkFile, bulkUploading, bulkResult, onBulkFileChange, onBulkUpload, onDownloadTemplate, bulkInputRef, onSetError, departments, managers }: Props) {
  return (
    <section className="rounded-2xl border p-5 sm:p-6" style={{ background: "var(--surface)", borderColor: "var(--border)", boxShadow: "var(--shadow-soft)" }}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--text-faint)]">Create team member</p>
          <h2 className="mt-1 text-lg font-semibold text-[var(--text-main)] sm:text-xl">Add employee or intern</h2>
        </div>
        <span className="shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold text-white sm:text-xs" style={{ background: "var(--accent-strong)" }}>{canBulkUpload ? "Admin bulk" : "Manager create"}</span>
      </div>
      <Field>
        <div className="mt-5 flex flex-col gap-3">
          <Input placeholder="Full name" value={form.name} onChange={(e) => onFormChange("name", e.target.value)} />
          <Input placeholder="Work email" value={form.email} onChange={(e) => onFormChange("email", e.target.value)} />
          <Input placeholder="Temporary password" value={form.password} onChange={(e) => onFormChange("password", e.target.value)} />
          <Select value={form.role} onChange={(e) => onFormChange("role", e.target.value)}>
            {createRoleOptions.map((r) => <option key={r} value={r}>{r}</option>)}
          </Select>
          <Input placeholder="Designation" value={form.designation} onChange={(e) => onFormChange("designation", e.target.value)} />
          <Select value={form.departmentId} onChange={(e) => onFormChange("departmentId", e.target.value)}>
            <option value="">Select department</option>
            {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </Select>
          <Select value={form.managerId} onChange={(e) => onFormChange("managerId", e.target.value)}>
            <option value="">Select manager</option>
            {managers.map((m) => <option key={m.id} value={m.id}>{m.name} — {m.role}</option>)}
          </Select>
          <button type="button" disabled={creating} onClick={onSubmit} className="h-11 w-full rounded-xl text-sm font-semibold text-white transition hover:opacity-95 disabled:cursor-wait disabled:opacity-70 sm:h-12 sm:rounded-2xl" style={{ background: "var(--accent-strong)" }}>
            {creating ? "Creating…" : "Create team member"}
          </button>
          {canBulkUpload ? (
            <div className="mt-2 rounded-2xl border p-4 sm:rounded-3xl sm:p-5" style={{ borderColor: "var(--border)", background: "var(--surface-soft)" }}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--text-faint)]">Bulk upload</p>
                  <h3 className="mt-1 text-base font-semibold text-[var(--text-main)] sm:text-lg">Import from CSV</h3>
                  <p className="mt-2 text-xs leading-relaxed text-[var(--text-soft)] sm:text-sm">Roles must be <code className="rounded bg-black/5 px-1">EMPLOYEE</code> or <code className="rounded bg-black/5 px-1">INTERN</code>.</p>
                </div>
                <button type="button" onClick={onDownloadTemplate} className="shrink-0 rounded-xl border px-3 py-2 text-xs font-semibold sm:text-sm" style={{ borderColor: "var(--border)", color: "var(--text-main)" }}>Sample CSV</button>
              </div>
              <details className="mt-3"><summary className="cursor-pointer text-xs font-semibold text-[var(--accent-strong)]">View column format</summary>
                <pre className="mt-2 max-h-40 overflow-auto rounded-xl border p-3 text-[10px] leading-relaxed text-[var(--text-soft)] sm:text-xs">{BULK_TEMPLATE}</pre>
              </details>
              <label className="mt-4 flex cursor-pointer flex-col gap-2 rounded-xl border-2 border-dashed px-4 py-6 text-center transition hover:border-blue-400/50 sm:rounded-2xl"
                onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                onDrop={(e) => { e.preventDefault(); e.stopPropagation(); const f = e.dataTransfer.files?.[0]; if (f && (f.type === "text/csv" || f.name.toLowerCase().endsWith(".csv"))) { onBulkFileChange(f); } else if (e.dataTransfer.files?.[0]) { onSetError("Please drop a .csv file."); showToast("Please drop a .csv file.","error"); } }}>
                <span className="text-sm font-semibold text-[var(--text-main)]">Drop a file or browse</span>
                <span className="text-xs text-[var(--text-soft)]">{bulkFile ? bulkFile.name : "No file selected — .csv up to 2MB"}</span>
                <input ref={bulkInputRef} type="file" accept=".csv,text/csv" className="sr-only" onChange={(e) => onBulkFileChange(e.target.files?.[0] ?? null)} />
              </label>
              <button type="button" disabled={bulkUploading || !bulkFile} onClick={onBulkUpload} className="mt-3 h-11 w-full rounded-xl text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-50 sm:rounded-2xl" style={{ background: "var(--accent-strong)" }}>
                {bulkUploading ? "Uploading…" : "Upload CSV"}
              </button>
              {bulkResult ? (
                <div className="mt-4 rounded-xl border p-3 text-sm" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
                  <p className="font-semibold text-[var(--text-main)]">{bulkResult.createdCount} created · {bulkResult.failedCount} failed</p>
                  {bulkResult.errors.length ? <ul className="mt-2 max-h-36 list-inside list-disc space-y-1 overflow-y-auto text-xs text-rose-600">{bulkResult.errors.slice(0, 8).map((item) => <li key={`${item.row}-${item.email ?? "row"}`}>Row {item.row}{item.email ? ` (${item.email})` : ""}: {item.message}</li>)}</ul> : null}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </Field>
    </section>
  );
}
