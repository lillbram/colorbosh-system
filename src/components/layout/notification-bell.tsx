import Link from "next/link";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getAttentionItems } from "@/lib/reports";
import { cn } from "@/lib/utils";

export async function NotificationBell() {
  let items: Awaited<ReturnType<typeof getAttentionItems>> = [];
  try {
    items = await getAttentionItems();
  } catch {
    // Non-critical — if this query fails or times out, show an empty bell
    // rather than taking the whole page down with it.
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="icon" variant="outline" className="relative">
          <Bell className="size-4" />
          {items.length > 0 && (
            <span className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-danger text-[10px] font-semibold text-white">
              {items.length > 9 ? "9+" : items.length}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        {items.length === 0 ? (
          <p className="px-2 py-3 text-center text-sm text-muted">Tidak ada yang perlu diperhatikan.</p>
        ) : (
          items.map((item, i) => (
            <DropdownMenuItem key={i} asChild>
              <Link href={item.href} className="flex items-start gap-2">
                <span
                  className={cn(
                    "mt-1 size-1.5 shrink-0 rounded-full",
                    item.severity === "danger" ? "bg-danger" : "bg-warning"
                  )}
                />
                <span className="text-sm">{item.label}</span>
              </Link>
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
