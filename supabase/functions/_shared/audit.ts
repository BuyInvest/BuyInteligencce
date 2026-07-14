// Shared audit-log helper for Edge Functions
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export type AuditEntry = {
  userId: string | null;
  action: string;
  resourceType?: string;
  resourceId?: string;
  metadata?: Record<string, unknown>;
  ip?: string | null;
  userAgent?: string | null;
};

export async function logAudit(admin: SupabaseClient, entry: AuditEntry, req?: Request) {
  try {
    const ip = entry.ip ?? req?.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
    const ua = entry.userAgent ?? req?.headers.get("user-agent") ?? null;
    await admin.from("audit_log").insert({
      user_id: entry.userId,
      action: entry.action,
      resource_type: entry.resourceType ?? null,
      resource_id: entry.resourceId ?? null,
      metadata: entry.metadata ?? {},
      ip,
      user_agent: ua,
    });
  } catch (e) {
    console.error("audit log failure", e);
  }
}
