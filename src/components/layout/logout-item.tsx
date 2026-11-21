"use client";

import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { logoutAction } from "@/lib/session-actions";

export function LogoutItem() {
  return <DropdownMenuItem onClick={() => logoutAction()}>Keluar</DropdownMenuItem>;
}
