"use client";

import type { ChatMessage, CRMUser } from "@/types/crm";
import { UserAvatar } from "@/components/shared/user-avatar";
import {
  formatTime,
  resolveAttachmentUrl,
  extractUrls,
  getUrlLabel,
} from "./chat-utils";

type Props = {
  message: ChatMessage;
  user: CRMUser;
  openMenuId: string | null;
  onOpenMenu: (id: string | null) => void;
  onReply: (message: ChatMessage) => void;
  onDeleteForMe: (id: string) => void;
  onDeleteForEveryone: (id: string) => void;
};

export function ChatMessageBubble({
  message,
  user,
  openMenuId,
  onOpenMenu,
  onReply,
  onDeleteForMe,
  onDeleteForEveryone,
}: Props) {
  const own = message.author.id === user.id;
  const canDelete = own || user.role === "ADMIN" || user.role === "SUPERADMIN";
  const attachmentUrl = resolveAttachmentUrl(message.attachmentUrl);
  const pdfUrl = attachmentUrl;

  return (
    <article className={`flex items-end gap-2 ${own ? "justify-end" : "justify-start"}`}>
      {!own && (
        <UserAvatar
          name={message.author.name}
          avatarUrl={message.author.avatarUrl}
          authProvider={message.author.authProvider}
          className="mb-1 h-8 w-8 shrink-0 rounded-full text-[10px]"
        />
      )}
      <div
        className="relative max-w-[min(88vw,560px)] rounded-2xl border px-3 py-2.5 sm:px-4 sm:py-3"
        style={{
          borderColor: own
            ? "color-mix(in srgb, var(--accent) 45%, var(--border))"
            : "var(--border)",
          background: own
            ? "color-mix(in srgb, var(--accent) 12%, var(--surface))"
            : "var(--surface-soft)",
        }}
      >
        <div className="mb-1 flex flex-wrap items-center gap-2 pr-8">
          <p className="text-sm font-semibold text-[var(--text-main)]">{message.author.name}</p>
          <span className="text-xs text-[var(--text-faint)]">{message.author.role}</span>
        </div>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onOpenMenu(openMenuId === message.id ? null : message.id);
          }}
          className="crm-touch-target absolute right-1 top-1 rounded-md px-2 py-1 text-sm text-[var(--text-soft)] hover:bg-black/5 sm:right-2 sm:top-2"
          aria-label="Message options"
        >
          ...
        </button>

        {openMenuId === message.id && (
          <div
            className="absolute right-2 top-9 z-20 min-w-40 rounded-xl border p-1 shadow-lg"
            style={{ borderColor: "var(--border)", background: "var(--surface)" }}
            onClick={(e) => e.stopPropagation()}
          >
            {!message.isDeleted && (
              <button
                type="button"
                className="block w-full rounded-lg px-3 py-2 text-left text-sm"
                style={{ color: "var(--text-main)" }}
                onClick={() => { onReply(message); onOpenMenu(null); }}
              >
                Reply
              </button>
            )}
            {canDelete && !message.isDeleted && (
              <>
                <button
                  type="button"
                  className="block w-full rounded-lg px-3 py-2 text-left text-sm"
                  style={{ color: "var(--text-main)" }}
                  onClick={() => { onDeleteForMe(message.id); onOpenMenu(null); }}
                >
                  Delete for me
                </button>
                <button
                  type="button"
                  className="block w-full rounded-lg px-3 py-2 text-left text-sm"
                  style={{ color: "var(--danger)" }}
                  onClick={() => { onDeleteForEveryone(message.id); onOpenMenu(null); }}
                >
                  Delete for everyone
                </button>
              </>
            )}
          </div>
        )}

        {message.replyTo && (
          <div
            className="mb-2 rounded-lg border-l-2 px-3 py-2 text-xs"
            style={{ borderColor: "var(--accent)", background: "var(--surface)" }}
          >
            <p className="font-semibold text-[var(--text-main)]">{message.replyTo.author.name}</p>
            <p className="text-[var(--text-soft)]">
              {message.replyTo.isDeleted
                ? "This message was deleted"
                : message.replyTo.messageType === "TEXT"
                  ? message.replyTo.content
                  : message.replyTo.messageType === "PDF"
                    ? message.replyTo.attachmentFileName || "PDF attachment"
                    : "Image attachment"}
            </p>
          </div>
        )}

        <p className="whitespace-pre-wrap break-words text-sm leading-6 text-[var(--text-main)] [overflow-wrap:anywhere]">
          {message.content}
        </p>

        {message.messageType === "TEXT" && (
          <div className="mt-3 flex flex-wrap gap-2">
            {extractUrls(message.content).map((url) => (
              <a
                key={`${message.id}-${url}`}
                href={url}
                target="_blank"
                rel="noreferrer"
                className="max-w-full truncate rounded-xl border px-3 py-1.5 text-xs font-semibold"
                style={{
                  borderColor: "var(--border)",
                  background: "var(--surface)",
                  color: "var(--text-main)",
                }}
              >
                {getUrlLabel(url)}
              </a>
            ))}
          </div>
        )}

        {message.attachmentUrl && !message.isDeleted && (
          <div className="mt-3">
            {message.messageType === "PDF" ? (
              <div className="flex flex-wrap items-center gap-2">
                <a
                  href={pdfUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex rounded-xl border px-3 py-2 text-sm font-medium text-[var(--text-main)]"
                  style={{ borderColor: "var(--border)", background: "var(--surface)" }}
                >
                  {message.attachmentFileName || "Open PDF"}
                </a>
                <a
                  href={pdfUrl}
                  download={message.attachmentFileName || "chat-attachment.pdf"}
                  className="inline-flex rounded-xl border px-3 py-2 text-sm font-medium text-[var(--text-main)]"
                  style={{ borderColor: "var(--border)", background: "var(--surface)" }}
                >
                  Download
                </a>
              </div>
            ) : (
              <img
                src={attachmentUrl}
                alt={message.attachmentFileName || "Attachment"}
                className={`rounded-xl border object-cover ${
                  message.messageType === "STICKER" ? "max-h-40 max-w-40" : "max-h-72 max-w-full"
                }`}
                style={{ borderColor: "var(--border)", background: "var(--surface)" }}
              />
            )}
          </div>
        )}

        <div className="mt-2 text-right text-xs text-[var(--text-faint)]">
          {formatTime(message.createdAt)}
        </div>
      </div>
    </article>
  );
}
