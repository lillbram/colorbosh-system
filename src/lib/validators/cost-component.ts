import { z } from "zod";

export const costComponentSchema = z.object({
  name: z.string().min(2, "Nama minimal 2 karakter"),
  category: z.enum(["fabric", "accessory", "packaging", "labor", "other"]),
  unit: z.string().min(1).default("pcs"),
  unitCost: z.coerce.number().min(0, "Biaya satuan wajib diisi"),
  notes: z.string().optional().or(z.literal("")),
  isActive: z
    .string()
    .default("true")
    .transform((v) => v === "true"),
});

export type CostComponentInput = z.infer<typeof costComponentSchema>;
