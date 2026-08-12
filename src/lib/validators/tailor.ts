import { z } from "zod";

export const tailorSchema = z.object({
  name: z.string().min(2, "Nama minimal 2 karakter"),
  phone: z.string().optional().or(z.literal("")),
  defaultTermin1Pct: z.coerce.number().min(0).max(100).default(50),
  defaultLeadTimeDays: z.coerce.number().min(1).default(7),
  notes: z.string().optional().or(z.literal("")),
});

export type TailorInput = z.infer<typeof tailorSchema>;
