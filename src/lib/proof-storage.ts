import { randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

const BUCKET = "proofs";
export const MAX_PROOF_BYTES = 5 * 1024 * 1024;
export const PROOF_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

const EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

/** Private bucket; paths are never public — view through a short-lived signed URL. */
export async function uploadProof(
  bytes: ArrayBuffer | Buffer,
  mimeType: string,
  userId: string
): Promise<string> {
  if (!(PROOF_MIME_TYPES as readonly string[]).includes(mimeType)) {
    throw new Error("Format foto harus JPG, PNG, atau WebP");
  }
  const size = bytes instanceof ArrayBuffer ? bytes.byteLength : bytes.length;
  if (size > MAX_PROOF_BYTES) throw new Error("Foto terlalu besar (maksimal 5 MB)");

  const now = new Date();
  const path = `${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, "0")}/${userId}-${randomUUID()}.${EXT[mimeType]}`;
  const { error } = await createAdminClient()
    .storage.from(BUCKET)
    .upload(path, bytes, { contentType: mimeType, upsert: false });
  if (error) throw new Error("Gagal mengunggah foto");
  return path;
}

export async function downloadProof(path: string): Promise<{ bytes: Buffer; mimeType: string }> {
  const { data, error } = await createAdminClient().storage.from(BUCKET).download(path);
  if (error || !data) throw new Error("Foto tidak ditemukan");
  return { bytes: Buffer.from(await data.arrayBuffer()), mimeType: data.type || "image/jpeg" };
}

export async function getSignedProofUrl(path: string, expiresInSeconds = 300): Promise<string | null> {
  const { data, error } = await createAdminClient().storage.from(BUCKET).createSignedUrl(path, expiresInSeconds);
  return error ? null : data.signedUrl;
}
