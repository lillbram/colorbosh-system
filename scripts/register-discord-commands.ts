/** Registers the slash commands in one server.  npx tsx scripts/register-discord-commands.ts */
import { config } from "dotenv";

config({ path: ".env.local" });

const commands = [
  {
    name: "laba",
    description: "Ringkasan laba rugi satu bulan",
    options: [{ type: 3, name: "bulan", description: "Format YYYY-MM, kosongkan untuk bulan ini", required: false }],
  },
  { name: "stok", description: "Total stok dan produk yang menipis" },
  { name: "kas", description: "Saldo kas dan modal berjalan" },
];

async function main() {
  const { DISCORD_BOT_TOKEN, DISCORD_APP_ID, DISCORD_GUILD_ID } = process.env;
  if (!DISCORD_BOT_TOKEN || !DISCORD_APP_ID || !DISCORD_GUILD_ID) {
    throw new Error("Set DISCORD_BOT_TOKEN, DISCORD_APP_ID and DISCORD_GUILD_ID in .env.local");
  }
  const res = await fetch(
    `https://discord.com/api/v10/applications/${DISCORD_APP_ID}/guilds/${DISCORD_GUILD_ID}/commands`,
    {
      method: "PUT",
      headers: { Authorization: `Bot ${DISCORD_BOT_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify(commands),
    }
  );
  if (!res.ok) throw new Error(`Discord ${res.status}: ${await res.text()}`);
  console.log("Registered:", commands.map((c) => c.name).join(", "));
}

main();
