import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Colorbosh",
    short_name: "Colorbosh",
    description: "Kelola penjualan, stok, dan kas bisnis Colorbosh.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#F9F7F3",
    theme_color: "#3B4EA0",
    // Share a screenshot from WhatsApp/Galeri straight into "Upload Bukti" (installed PWA only).
    share_target: {
      action: "/cash-flow/receipt/share",
      method: "POST",
      enctype: "multipart/form-data",
      params: { files: [{ name: "image", accept: ["image/*"] }] },
    },
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
