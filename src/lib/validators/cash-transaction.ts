import { z } from "zod";

export const cashTransactionSchema = z.object({
  txnDate: z.string().min(1, "Tanggal wajib diisi"),
  accountId: z.string().uuid("Pilih akun"),
  direction: z.enum(["in", "out"]),
  amount: z.coerce.number().positive("Nominal harus lebih dari 0"),
  categoryId: z.string().uuid().optional().or(z.literal("")),
  description: z.string().min(1, "Keterangan wajib diisi"),
});

export type CashTransactionInput = z.infer<typeof cashTransactionSchema>;

export const cashBulkRowSchema = z.object({
  txnDate: z.string().min(1),
  direction: z.enum(["in", "out"]),
  accountId: z.string().uuid(),
  categoryId: z.string().uuid().optional().or(z.literal("")),
  description: z.string().min(1),
  amount: z.coerce.number().positive(),
});

export const cashBulkImportSchema = z.object({
  rows: z.array(cashBulkRowSchema).min(1, "Tidak ada baris valid untuk diimpor"),
});

export type CashBulkImportInput = z.infer<typeof cashBulkImportSchema>;
