"use client";

import { useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Menu } from "lucide-react";
import { SidebarContent } from "@/components/layout/sidebar";

export function MobileNav() {
  const [open, setOpen] = useState(false);

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Trigger
        aria-label="Buka menu"
        className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg border border-border/70 text-ink hover:bg-canvas md:hidden"
      >
        <Menu className="size-5" />
      </DialogPrimitive.Trigger>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/40 md:hidden" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className="fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] bg-white shadow-xl md:hidden"
        >
          <DialogPrimitive.Title className="sr-only">Menu</DialogPrimitive.Title>
          <SidebarContent onNavigate={() => setOpen(false)} />
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
