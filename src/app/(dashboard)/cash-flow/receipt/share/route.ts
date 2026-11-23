import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUserId } from "@/lib/auth";
import { MAX_PROOF_BYTES, PROOF_MIME_TYPES, uploadProof } from "@/lib/proof-storage";

/**
 * PWA share target (manifest `share_target`): receives an image shared from
 * WhatsApp/Galeri, stores it in the private bucket and sends the user to the
 * receipt page, which reads it. Requires a signed-in session (proxy.ts).
 */
export async function POST(request: NextRequest) {
  const back = (path: string) => NextResponse.redirect(new URL(path, request.url), 303);

  const userId = await getCurrentUserId();
  if (!userId) return back("/login");

  const form = await request.formData();
  const file = form.get("image");
  if (!(file instanceof File) || file.size === 0) return back("/cash-flow/receipt");
  if (!(PROOF_MIME_TYPES as readonly string[]).includes(file.type) || file.size > MAX_PROOF_BYTES) {
    return back("/cash-flow/receipt");
  }

  try {
    const path = await uploadProof(Buffer.from(await file.arrayBuffer()), file.type, userId);
    return back(`/cash-flow/receipt?inbox=${encodeURIComponent(path)}`);
  } catch {
    return back("/cash-flow/receipt");
  }
}
