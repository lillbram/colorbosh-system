import { z } from "zod";

export const accountSchema = z.object({
  name: z.string().min(2, "Nama minimal 2 karakter"),
  type: z.enum(["bank", "cash", "e_wallet"]),
  openingBalance: z.coerce.number().min(0).default(0),
  isActive: z
    .string()
    .default("true")
    .transform((v) => v === "true"),
});

export type AccountInput = z.infer<typeof accountSchema>;
