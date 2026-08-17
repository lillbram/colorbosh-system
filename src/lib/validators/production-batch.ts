import { z } from "zod";

export const batchProductSchema = z.object({
  productId: z.string().uuid("Pilih produk"),
  qty: z.coerce.number().positive("Qty harus lebih dari 0"),
});

export const batchCostItemSchema = z.object({
  costComponentId: z.string().uuid().optional(),
  label: z.string().min(1, "Label biaya wajib diisi"),
  qty: z.coerce.number().positive().optional(),
  unitCost: z.coerce.number().min(0).optional(),
  subtotal: z.coerce.number().min(0, "Subtotal tidak boleh negatif"),
  isAdditional: z.boolean().default(false),
});

export const productionBatchSchema = z.object({
  tailorId: z.string().uuid("Pilih penjahit"),
  fabricSource: z.enum(["from_po", "tailor_own"]).default("from_po"),
  fabricUsedMeters: z.coerce.number().min(0).optional(),
  startDate: z.string().min(1, "Tanggal mulai wajib diisi"),
  targetFinishDate: z.string().min(1, "Target selesai wajib diisi"),
  notes: z.string().optional().or(z.literal("")),
  products: z.array(batchProductSchema).min(1, "Minimal 1 produk"),
  costItems: z.array(batchCostItemSchema).min(1, "Tambahkan minimal 1 biaya"),
  termin1Amount: z.coerce.number().min(0, "Nominal Termin 1 tidak boleh negatif"),
});

export type ProductionBatchInput = z.infer<typeof productionBatchSchema>;

export const finishBatchProductSchema = z.object({
  productionBatchProductId: z.string().uuid(),
  actualQty: z.coerce.number().min(0, "Qty aktual tidak boleh negatif"),
});

export const finishBatchSchema = z.object({
  actualFinishDate: z.string().min(1, "Tanggal selesai wajib diisi"),
  products: z.array(finishBatchProductSchema).min(1, "Minimal 1 produk"),
});

export type FinishBatchInput = z.infer<typeof finishBatchSchema>;

export const payTerminSchema = z.object({
  paidDate: z.string().min(1, "Tanggal bayar wajib diisi"),
  method: z.enum(["transfer", "cash", "cod", "other"]),
  accountId: z.string().uuid("Pilih akun"),
});

export type PayTerminInput = z.infer<typeof payTerminSchema>;

export const editTerminAmountSchema = z.object({
  amount: z.coerce.number().min(0, "Nominal tidak boleh negatif"),
});

export type EditTerminAmountInput = z.infer<typeof editTerminAmountSchema>;
