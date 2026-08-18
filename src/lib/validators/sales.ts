import { z } from "zod";

export const manualSaleSchema = z.object({
  entryDate: z.string().min(1, "Tanggal wajib diisi"),
  channelId: z.string().uuid("Pilih channel"),
  productId: z.string().uuid("Pilih produk"),
  qty: z.coerce.number().positive("Qty harus lebih dari 0"),
  grossAmount: z.coerce.number().positive("Nominal harus lebih dari 0"),
  discount: z.coerce.number().min(0).default(0),
  orderRef: z.string().optional().or(z.literal("")),
  buyerNote: z.string().optional().or(z.literal("")),
  accountId: z.string().uuid("Pilih akun tujuan"),
});

export type ManualSaleInput = z.infer<typeof manualSaleSchema>;

export const liveEntryRowSchema = z.object({
  productId: z.string().uuid(),
  qty: z.coerce.number().positive(),
  unitPrice: z.coerce.number().min(0),
});

export const liveSessionSchema = z.object({
  sessionDate: z.string().min(1, "Tanggal wajib diisi"),
  channelId: z.string().uuid("Pilih channel"),
  hostName: z.string().optional().or(z.literal("")),
  notes: z.string().optional().or(z.literal("")),
  entries: z.array(liveEntryRowSchema).min(1, "Minimal 1 produk"),
  accountId: z.string().uuid("Pilih akun tujuan"),
});

export type LiveSessionInput = z.infer<typeof liveSessionSchema>;

export const csvImportRowSchema = z.object({
  orderRef: z.string().min(1),
  entryDate: z.string().min(1),
  productId: z.string().uuid(),
  qty: z.coerce.number().positive(),
  grossAmount: z.coerce.number().min(0),
});

export const csvImportSchema = z.object({
  channelId: z.string().uuid("Pilih channel"),
  accountId: z.string().uuid("Pilih akun tujuan"),
  rows: z.array(csvImportRowSchema).min(1, "Tidak ada baris valid untuk diimpor"),
});

export type CsvImportInput = z.infer<typeof csvImportSchema>;

export const posCartItemSchema = z.object({
  productId: z.string().uuid(),
  qty: z.coerce.number().positive(),
  unitPrice: z.coerce.number().min(0),
});

export const posOrderSchema = z.object({
  channelId: z.string().uuid("Pilih channel"),
  buyerNote: z.string().optional().or(z.literal("")),
  items: z.array(posCartItemSchema).min(1, "Keranjang masih kosong"),
  accountId: z.string().uuid("Pilih akun tujuan"),
});

export type PosOrderInput = z.infer<typeof posOrderSchema>;
