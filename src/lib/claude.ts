import Anthropic from "@anthropic-ai/sdk";
import { db } from "@/db";
import { writeAuditLog } from "@/lib/audit";

/** Server-only Claude client for the in-app assistant (Phase 7). Never import from a Client Component. */
export const CLAUDE_MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5";

export function claudeEnabled(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}

export function getClaude(): Anthropic {
  return new Anthropic();
}

/**
 * Records token usage per feature in audit_logs (entity = the user). Only
 * counts are stored — never prompts, answers or images.
 */
export async function logAiUsage(
  userId: string | null,
  feature: string,
  usage: { input_tokens: number; output_tokens: number }
) {
  if (!userId) return;
  try {
    await writeAuditLog(db, {
      entityType: "ai_usage",
      entityId: userId,
      action: "create",
      actorId: userId,
      diff: { feature, model: CLAUDE_MODEL, inputTokens: usage.input_tokens, outputTokens: usage.output_tokens },
    });
  } catch {
    // Usage logging must never break the feature.
  }
}
