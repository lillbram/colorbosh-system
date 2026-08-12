import { z } from "zod";

export const categorySchema = z.object({
  name: z.string().min(2, "Nama minimal 2 karakter"),
  kind: z.enum(["income", "expense"]),
});

export type CategoryInput = z.infer<typeof categorySchema>;
