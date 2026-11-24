import { test } from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync, sign } from "node:crypto";
import { isAllowed, verifyDiscordRequest } from "./discord";

const { publicKey, privateKey } = generateKeyPairSync("ed25519");
const pubHex = publicKey.export({ format: "der", type: "spki" }).subarray(-32).toString("hex");
const signed = (ts: string, body: string) => sign(null, Buffer.from(ts + body), privateKey).toString("hex");

test("valid signature passes, tampered body or missing key fails", () => {
  const sig = signed("123", "{}");
  assert.equal(verifyDiscordRequest("{}", sig, "123", pubHex), true);
  assert.equal(verifyDiscordRequest('{"x":1}', sig, "123", pubHex), false);
  assert.equal(verifyDiscordRequest("{}", sig, "123", undefined), false);
  assert.equal(verifyDiscordRequest("{}", "zz", "123", pubHex), false);
});

test("allow-list denies by default and checks server, channel and user", () => {
  process.env.DISCORD_GUILD_ID = "g";
  process.env.DISCORD_CHANNEL_IDS = "c1";
  process.env.DISCORD_ALLOWED_USER_IDS = "u1,u2";
  assert.equal(isAllowed({ guildId: "g", channelId: "c1", userId: "u2" }), true);
  assert.equal(isAllowed({ guildId: "g", channelId: "c2", userId: "u1" }), false);
  assert.equal(isAllowed({ guildId: "x", channelId: "c1", userId: "u1" }), false);
  assert.equal(isAllowed({ guildId: "g", channelId: "c1", userId: "u3" }), false);
  delete process.env.DISCORD_ALLOWED_USER_IDS;
  assert.equal(isAllowed({ guildId: "g", channelId: "c1", userId: "u1" }), false);
});
