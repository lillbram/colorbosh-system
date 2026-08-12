"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronsUpDown, HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { MAIN_NAV, SETTINGS_NAV } from "@/lib/constants";

function NavLink({
  href,
  label,
  icon: Icon,
  active,
}: {
  href: string;
  label: string;
  icon: (typeof MAIN_NAV)[number]["icon"];
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
        active
          ? "bg-primary-50 text-primary-700"
          : "text-muted hover:bg-black/5 hover:text-ink"
      )}
    >
      <Icon className="size-4.5" />
      {label}
    </Link>
  );
}

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex h-screen w-64 shrink-0 flex-col border-r border-border/70 bg-white px-3 py-4">
      <button className="flex items-center gap-2 rounded-lg border border-border/70 px-3 py-2 text-left hover:bg-canvas">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-500 text-sm font-semibold text-white">
          C
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-ink">Cardigan Biz</p>
          <p className="truncate text-xs text-muted">Owner</p>
        </div>
        <ChevronsUpDown className="size-4 text-muted" />
      </button>

      <nav className="mt-4 flex flex-1 flex-col gap-1 overflow-y-auto">
        {MAIN_NAV.map((item) => (
          <NavLink
            key={item.href}
            {...item}
            active={pathname === item.href}
          />
        ))}

        <p className="mt-5 px-3 text-xs font-semibold uppercase tracking-wide text-muted/70">
          Data Master
        </p>
        {SETTINGS_NAV.map((item) => (
          <NavLink
            key={item.href}
            {...item}
            active={pathname === item.href}
          />
        ))}
      </nav>

      <Link
        href="/help"
        className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-muted hover:bg-black/5 hover:text-ink"
      >
        <HelpCircle className="size-4.5" />
        Bantuan
      </Link>
    </aside>
  );
}
