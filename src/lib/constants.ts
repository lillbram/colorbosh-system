import {
  LayoutDashboard,
  PackageSearch,
  Shirt,
  ShoppingBag,
  Wallet,
  Landmark,
  FileBarChart,
  Users,
  Truck,
  Scissors,
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
  { label: "Pemesanan Kain", href: "/procurement", icon: PackageSearch },
  { label: "Batch Produksi", href: "/production", icon: Shirt },
  { label: "Penjualan", href: "/sales", icon: ShoppingBag },
  { label: "Pencairan Dana", href: "/disbursement", icon: Wallet },
  { label: "Arus Kas", href: "/cash-flow", icon: Landmark },
  { label: "Laporan", href: "/reports", icon: FileBarChart },
];

export const SETTINGS_NAV: NavItem[] = [
  { label: "Supplier", href: "/settings/suppliers", icon: Truck },
  { label: "Penjahit", href: "/settings/tailors", icon: Scissors },
  { label: "Produk", href: "/settings/products", icon: Layers },
  { label: "Komponen Biaya Produksi", href: "/settings/cost-components", icon: Calculator },
  { label: "Channel", href: "/settings/channels", icon: Store },
  { label: "Akun Kas & Bank", href: "/settings/accounts", icon: Landmark },
  { label: "Kategori", href: "/settings/categories", icon: Tag },
  { label: "Pengguna", href: "/settings/users", icon: Users },
];
