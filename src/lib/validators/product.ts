import { z } from "zod";

export const productSchema = z.object({
  name: z.string().min(2, "Nama minimal 2 karakter"),
  sku: z.string().optional().or(z.literal("")),
  category: z.string().optional().or(z.literal("")),
  basePrice: z.coerce.number().min(0).max(999_999_999).optional(),
  hppTarget: z.coerce.number().min(0).max(999_999_999).optional(),
  isActive: z
    .string()
    .default("true")
    .transform((v) => v === "true"),
});

export type ProductInput = z.infer<typeof productSchema>;
