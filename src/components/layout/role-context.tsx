"use client";

import { createContext, useContext } from "react";
import type { Role } from "@/lib/auth";

const RoleContext = createContext<Role | null>(null);

export function RoleProvider({ role, children }: { role: Role | null; children: React.ReactNode }) {
  return <RoleContext.Provider value={role}>{children}</RoleContext.Provider>;
}

export function useRole() {
  return useContext(RoleContext);
}
