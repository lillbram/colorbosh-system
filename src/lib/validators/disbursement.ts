import { z } from "zod";

export const confirmPayoutSchema = z.object({
  channelId: z.string().uuid("Pilih channel"),
  accountId: z.string().uuid("Pilih akun tujuan"),
  actualDate: z.string().min(1, "Tanggal wajib diisi"),
  actualAmount: z.coerce.number().positive("Nominal harus lebih dari 0"),
  bankRef: z.string().optional().or(z.literal("")),
  notes: z.string().optional().or(z.literal("")),
});

export type ConfirmPayoutInput = z.infer<typeof confirmPayoutSchema>;
