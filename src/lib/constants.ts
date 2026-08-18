import {
  LayoutDashboard,
  ShoppingBag,
  Landmark,
  FileBarChart,
  Users,
  Tag,
  Layers,
  Store,
  Calculator,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
};

export const MAIN_NAV: NavItem[] = [
  { label: "Dashboard", href: "/", icon: LayoutDashboard },
  { label: "Penjualan", href: "/sales", icon: ShoppingBag },
  { label: "Arus Kas", href: "/cash-flow", icon: Landmark },
  { label: "Laporan", href: "/reports", icon: FileBarChart },
];

export const SETTINGS_NAV: NavItem[] = [
  { label: "Produk", href: "/settings/products", icon: Layers },
  { label: "Komponen Biaya Produksi", href: "/settings/cost-components", icon: Calculator },
  { label: "Channel", href: "/settings/channels", icon: Store },
  { label: "Akun Kas & Bank", href: "/settings/accounts", icon: Landmark },
  { label: "Kategori", href: "/settings/categories", icon: Tag },
  { label: "Pengguna", href: "/settings/users", icon: Users },
];
