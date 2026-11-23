/** One-off: creates the private `proofs` storage bucket.  npx tsx scripts/create-proofs-bucket.ts */
import { config } from "dotenv";

config({ path: ".env.local" });

async function main() {
  const { createAdminClient } = await import("../src/lib/supabase/admin");
  const admin = createAdminClient();
  const { data: existing } = await admin.storage.getBucket("proofs");
  if (existing) {
    console.log("Bucket `proofs` already exists (public:", existing.public, ")");
    return;
  }
  const { error } = await admin.storage.createBucket("proofs", {
    public: false,
    fileSizeLimit: 5 * 1024 * 1024,
    allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
  });
  if (error) throw error;
  console.log("Created private bucket `proofs`.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
