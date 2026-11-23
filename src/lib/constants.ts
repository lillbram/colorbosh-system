import {
  LayoutDashboard,
  ShoppingBag,
  Landmark,
  FileBarChart,
  Users,
  Tag,
  Layers,
  Boxes,
  Store,
  Scale,
  Banknote,
  SlidersHorizontal,
  MessageCircleQuestion,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Hidden from admins (server-side pages also enforce it). */
  ownerOnly?: boolean;
};

export const MAIN_NAV: NavItem[] = [
  { label: "Dashboard", href: "/", icon: LayoutDashboard },
  { label: "Penjualan", href: "/sales", icon: ShoppingBag },
  { label: "Stok", href: "/stock", icon: Boxes },
  { label: "Arus Kas", href: "/cash-flow", icon: Landmark },
  { label: "Laporan", href: "/reports", icon: FileBarChart },
  { label: "Modal", href: "/capital", icon: Scale, ownerOnly: true },
  { label: "Gaji", href: "/salary", icon: Banknote, ownerOnly: true },
  { label: "Tanya", href: "/ask", icon: MessageCircleQuestion, ownerOnly: true },
];

export const SETTINGS_NAV: NavItem[] = [
  { label: "Umum", href: "/settings/general", icon: SlidersHorizontal },
  { label: "Produk", href: "/settings/products", icon: Layers },
  { label: "Channel", href: "/settings/channels", icon: Store },
  { label: "Akun Kas & Bank", href: "/settings/accounts", icon: Landmark },
  { label: "Kategori", href: "/settings/categories", icon: Tag },
  { label: "Pengguna", href: "/settings/users", icon: Users },
];
