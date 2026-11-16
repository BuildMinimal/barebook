"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Clock,
  LayoutDashboard,
  ReceiptText,
  Settings,
  Users,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/cn";

const LINKS: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/clients", label: "Clients", icon: Users },
  { href: "/invoices", label: "Invoices", icon: ReceiptText },
  { href: "/time", label: "Time", icon: Clock },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function NavLinks() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-0.5">
      {LINKS.map((link) => {
        const active =
          link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
        const Icon = link.icon;
        return (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              "flex items-center gap-2.5 rounded-md px-3 py-1.5 text-sm transition-colors",
              active
                ? "bg-surface-2 font-medium text-foreground"
                : "text-muted hover:bg-surface-2 hover:text-foreground",
            )}
          >
            <Icon
              size={15}
              aria-hidden="true"
              className="shrink-0"
              strokeWidth={active ? 2.25 : 2}
            />
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
