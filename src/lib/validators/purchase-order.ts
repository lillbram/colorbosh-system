import { z } from "zod";

export const poItemSchema = z.object({
  itemType: z.enum(["fabric_roll", "accessory", "packaging", "other"]),
  description: z.string().min(1, "Deskripsi wajib diisi"),
  qtyOrdered: z.coerce.number().positive("Qty harus lebih dari 0"),
  unit: z.string().min(1).default("pcs"),
  unitPrice: z.coerce.number().min(0),
});

export const purchaseOrderSchema = z.object({
  supplierId: z.string().uuid("Pilih supplier"),
  orderDate: z.string().min(1, "Tanggal pesan wajib diisi"),
  expectedDate: z.string().optional().or(z.literal("")),
  notes: z.string().optional().or(z.literal("")),
  items: z.array(poItemSchema).min(1, "Minimal 1 item"),
});

export type PurchaseOrderInput = z.infer<typeof purchaseOrderSchema>;

export const poPaymentSchema = z.object({
  amount: z.coerce.number().positive("Nominal harus lebih dari 0"),
  paymentDate: z.string().min(1, "Tanggal bayar wajib diisi"),
  method: z.enum(["transfer", "cash", "cod", "other"]),
  accountId: z.string().uuid("Pilih akun"),
  notes: z.string().optional().or(z.literal("")),
});

export type PoPaymentInput = z.infer<typeof poPaymentSchema>;

export const receiveGoodsSchema = z.object({
  actualArrivalDate: z.string().min(1, "Tanggal terima wajib diisi"),
  items: z.array(z.object({ id: z.string().uuid(), qtyReceived: z.coerce.number().min(0) })),
});

export type ReceiveGoodsInput = z.infer<typeof receiveGoodsSchema>;
