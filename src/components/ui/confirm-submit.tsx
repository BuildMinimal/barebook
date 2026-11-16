"use client";

import type { ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * Submit button with a native confirm() guard — for destructive forms
 * (delete client/project/entry). Lives outside any useActionState flow.
 * `iconOnly` renders the lucide X mark with the children as screen-reader
 * text, for the compact table-row buttons.
 */
export function ConfirmSubmit({
  children,
  message,
  className,
  title,
  iconOnly = false,
}: {
  children: ReactNode;
  message: string;
  className?: string;
  title?: string;
  iconOnly?: boolean;
}) {
  return (
    <button
      type="submit"
      title={title}
      className={cn(
        "inline-flex h-8 items-center justify-center rounded-md px-3 text-sm font-medium",
        "text-danger transition-colors hover:bg-danger-soft",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        iconOnly && "w-8 px-0",
        className,
      )}
      onClick={(e) => {
        if (!window.confirm(message)) {
          e.preventDefault();
        }
      }}
    >
      {iconOnly ? (
        <>
          <X size={14} aria-hidden="true" />
          <span className="sr-only">{children}</span>
        </>
      ) : (
        children
      )}
    </button>
  );
}
