import type { SelectHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

/**
 * Native select styled to match Input. The background chevron is lucide's
 * chevron-down path inlined as a data URI (a background image is the only
 * way to style the native control's arrow). Radix Select comes later only
 * where search/typeahead is genuinely needed (e.g. client picker on
 * invoices); for plain choices the native control is lighter and
 * keyboard-perfect.
 */
export function Select({
  className,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "h-9 w-full appearance-none rounded-md border border-border-subtle bg-surface px-3 pr-8 text-sm text-foreground",
        "bg-[url('data:image/svg+xml;charset=utf-8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2212%22 height=%2212%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%2371717a%22 stroke-width=%222%22 stroke-linecap=%22round%22 stroke-linejoin=%22round%22><path d=%22m6 9 6 6 6-6%22/></svg>')] bg-no-repeat bg-[position:right_0.75rem_center]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}
