"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Submit button with a native confirm() guard — for destructive forms
 * (delete client/project/entry). Lives outside any useActionState flow.
 */
export function ConfirmSubmit({
  children,
  message,
  className,
  title,
}: {
  children: ReactNode;
  message: string;
  className?: string;
  title?: string;
}) {
  return (
    <button
      type="submit"
      title={title}
      className={cn(
        "inline-flex h-8 items-center rounded-md px-3 text-sm font-medium",
        "text-danger transition-colors hover:bg-danger-soft",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
      onClick={(e) => {
        if (!window.confirm(message)) {
          e.preventDefault();
        }
      }}
    >
      {children}
    </button>
  );
}
