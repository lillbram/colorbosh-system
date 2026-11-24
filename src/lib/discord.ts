import { createPublicKey, verify } from "node:crypto";

// DER prefix that wraps a raw 32-byte Ed25519 public key into SPKI.
const ED25519_SPKI_PREFIX = Buffer.from("302a300506032b6570032100", "hex");

/** Verifies Discord's Ed25519 request signature. Fails closed when the key is missing or malformed. */
export function verifyDiscordRequest(
  body: string,
  signature: string | null,
  timestamp: string | null,
  publicKeyHex: string | undefined
): boolean {
  if (!signature || !timestamp || !publicKeyHex) return false;
  try {
    const key = createPublicKey({
      key: Buffer.concat([ED25519_SPKI_PREFIX, Buffer.from(publicKeyHex, "hex")]),
      format: "der",
      type: "spki",
    });
    return verify(null, Buffer.from(timestamp + body), key, Buffer.from(signature, "hex"));
  } catch {
    return false;
  }
}

function idList(raw: string | undefined): string[] {
  return (raw ?? "").split(/[\s,]+/).filter(Boolean);
}

/** Only the configured server, channels and people may run commands. Empty config denies everyone. */
export function isAllowed(ctx: { guildId?: string; channelId?: string; userId?: string }): boolean {
  const guild = process.env.DISCORD_GUILD_ID;
  const channels = idList(process.env.DISCORD_CHANNEL_IDS);
  const users = idList(process.env.DISCORD_ALLOWED_USER_IDS);
  if (!guild || channels.length === 0 || users.length === 0) return false;
  return ctx.guildId === guild && !!ctx.channelId && channels.includes(ctx.channelId) && !!ctx.userId && users.includes(ctx.userId);
}
