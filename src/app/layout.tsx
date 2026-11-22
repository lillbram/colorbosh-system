import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { Toaster } from "sonner";
import { ServiceWorkerRegister } from "@/components/layout/sw-register";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Colorbosh",
  description: "Kelola penjualan, stok, dan kas bisnis Colorbosh.",
  icons: { icon: "/logo.svg", apple: "/icons/apple-touch-icon.png" },
  appleWebApp: { capable: true, title: "Colorbosh", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#3B4EA0",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="id"
      className={`${inter.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <ServiceWorkerRegister />
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
