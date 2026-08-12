"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { channels } from "@/db/schema";
import { getCurrentUserId } from "@/lib/auth";
import { withAudit } from "@/lib/audit";
import { channelSchema } from "@/lib/validators/channel";

function toDbValues(data: ReturnType<typeof channelSchema.parse>) {
  return {
    name: data.name,
    type: data.type,
    defaultFeePct: String(data.defaultFeePct),
    defaultHoldDays: data.defaultHoldDays,
  };
}

export async function createChannel(formData: FormData) {
  const parsed = channelSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Data tidak valid" };
  }

  const actorId = await getCurrentUserId();
  let newId = "";

  try {
    await withAudit(
      { entityType: "channel", entityId: () => newId, action: "create", actorId },
      async (tx) => {
        const [inserted] = await tx
          .insert(channels)
          .values(toDbValues(parsed.data))
          .returning();
        newId = inserted.id;
      }
    );
  } catch {
    return { error: "Gagal menyimpan channel" };
  }

  revalidatePath("/settings/channels");
  return { success: true };
}

export async function updateChannel(id: string, formData: FormData) {
  const parsed = channelSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Data tidak valid" };
  }

  const actorId = await getCurrentUserId();

  try {
    await withAudit(
      { entityType: "channel", entityId: id, action: "update", actorId },
      async (tx) => {
        await tx.update(channels).set(toDbValues(parsed.data)).where(eq(channels.id, id));
      }
    );
  } catch {
    return { error: "Gagal memperbarui channel" };
  }

  revalidatePath("/settings/channels");
  return { success: true };
}
