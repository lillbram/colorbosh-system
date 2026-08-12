import { Suspense } from "react";
import { Bell, Search, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Avatar,
  AvatarFallback,
} from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { NotificationBell } from "@/components/layout/notification-bell";
import { LogoutItem } from "@/components/layout/logout-item";

export function Header({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <header className="flex flex-col gap-4 border-b border-border/70 bg-white px-6 py-4 md:flex-row md:items-center md:justify-between">
      <div>
        <h1 className="text-h1 text-ink">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-muted">{subtitle}</p>}
      </div>

      <div className="flex items-center gap-2">
        <div className="hidden items-center gap-2 rounded-lg border border-border/70 px-3 py-2 text-sm text-muted md:flex">
          <Search className="size-4" />
          <span>Cari transaksi...</span>
        </div>
        <Suspense
          fallback={
            <Button size="icon" variant="outline">
              <Bell className="size-4" />
            </Button>
          }
        >
          <NotificationBell />
        </Suspense>
        <Button size="icon" variant="outline" asChild>
          <a href="/settings/suppliers">
            <Settings className="size-4" />
          </a>
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="rounded-full">
              <Avatar>
                <AvatarFallback>OW</AvatarFallback>
              </Avatar>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild>
              <a href="/settings/users">Pengaturan</a>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <LogoutItem />
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
