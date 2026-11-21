"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import {
  Boxes,
  Landmark,
  LayoutDashboard,
  PackagePlus,
  Plus,
  Radio,
  ScanLine,
  ShoppingBag,
  ShoppingCart,
  X,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Tab = { label: string; href: string; icon: LucideIcon };

const LEFT: Tab[] = [
  { label: "Beranda", href: "/", icon: LayoutDashboard },
  { label: "Penjualan", href: "/sales", icon: ShoppingBag },
];
const RIGHT: Tab[] = [
  { label: "Stok", href: "/stock", icon: Boxes },
  { label: "Kas", href: "/cash-flow", icon: Landmark },
];

const QUICK_ACTIONS: { label: string; hint: string; href: string; icon: LucideIcon }[] = [
  { label: "Catat Penjualan", hint: "Kasir (POS)", href: "/sales/new/pos", icon: ShoppingCart },
  { label: "Rekap Live", hint: "Hitung penjualan live", href: "/sales/new/live", icon: Radio },
  { label: "Stok Masuk", hint: "Barang dari penjahit", href: "/stock?new=1", icon: PackagePlus },
  { label: "Upload Bukti", hint: "Foto bukti transfer", href: "/cash-flow?new=1", icon: ScanLine },
];

function TabLink({ tab, pathname }: { tab: Tab; pathname: string }) {
  const active = tab.href === "/" ? pathname === "/" : pathname.startsWith(tab.href);
  const Icon = tab.icon;
  return (
    <li>
      <Link
        href={tab.href}
        className={cn(
          "flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium transition-colors",
          active ? "text-primary-600" : "text-muted"
        )}
      >
        <Icon className="size-5" />
        {tab.label}
      </Link>
    </li>
  );
}

export function BottomNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border/70 bg-white pb-[env(safe-area-inset-bottom)] md:hidden">
      <ul className="grid grid-cols-5">
        {LEFT.map((t) => (
          <TabLink key={t.href} tab={t} pathname={pathname} />
        ))}
        <li className="flex items-center justify-center">
          <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
            <DialogPrimitive.Trigger
              aria-label="Tambah baru"
              className="-mt-5 flex size-14 items-center justify-center rounded-full bg-accent-500 text-white shadow-lg active:bg-accent-600"
            >
              <Plus className="size-7" />
            </DialogPrimitive.Trigger>
            <DialogPrimitive.Portal>
              <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/40" />
              <DialogPrimitive.Content
                aria-describedby={undefined}
                className="fixed inset-x-0 bottom-0 z-50 rounded-t-2xl bg-white p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-xl"
              >
                <div className="mb-3 flex items-center justify-between">
                  <DialogPrimitive.Title className="text-h3 text-ink">Tambah baru</DialogPrimitive.Title>
                  <DialogPrimitive.Close aria-label="Tutup" className="rounded-md p-1 text-muted hover:bg-canvas">
                    <X className="size-5" />
                  </DialogPrimitive.Close>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {QUICK_ACTIONS.map(({ label, hint, href, icon: Icon }) => (
                    <Link
                      key={href}
                      href={href}
                      onClick={() => setOpen(false)}
                      className="flex flex-col items-start gap-2 rounded-card border border-border/70 p-4 active:bg-canvas"
                    >
                      <span className="flex size-10 items-center justify-center rounded-full bg-primary-50">
                        <Icon className="size-5 text-primary-500" />
                      </span>
                      <span>
                        <span className="block text-sm font-semibold text-ink">{label}</span>
                        <span className="block text-xs text-muted">{hint}</span>
                      </span>
                    </Link>
                  ))}
                </div>
              </DialogPrimitive.Content>
            </DialogPrimitive.Portal>
          </DialogPrimitive.Root>
        </li>
        {RIGHT.map((t) => (
          <TabLink key={t.href} tab={t} pathname={pathname} />
        ))}
      </ul>
    </nav>
  );
}
