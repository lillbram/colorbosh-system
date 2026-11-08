"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { MAIN_NAV } from "@/lib/constants";

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border/70 bg-white pb-[env(safe-area-inset-bottom)] md:hidden">
      <ul className="grid grid-cols-4">
        {MAIN_NAV.map(({ href, label, icon: Icon }) => {
          const active =
            href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <li key={href}>
              <Link
                href={href}
                className={cn(
                  "flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium transition-colors",
                  active ? "text-primary-600" : "text-muted"
                )}
              >
                <Icon className="size-5" />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
