import { z } from "zod";

export const channelSchema = z.object({
  name: z.string().min(2, "Nama minimal 2 karakter"),
  type: z.enum(["tiktok_live", "tiktok_shop", "shopee", "other"]),
  defaultFeePct: z.coerce.number().min(0).max(100).default(0),
  defaultHoldDays: z.coerce.number().min(0).default(0),
});

export type ChannelInput = z.infer<typeof channelSchema>;
