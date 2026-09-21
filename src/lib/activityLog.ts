import "server-only";
import type { createClient } from "@/lib/supabase/server";

export type ActivityActionType =
  | "quote_sent"
  | "quote_status_changed"
  | "employee_added"
  | "employee_updated"
  | "employee_removed"
  | "expense_item_added"
  | "company_updated";

/** 대시보드 "최근 활동" 피드에 기록. 실패해도 주 동작(견적 발송 등)은 막지 않는다. */
export async function logActivity(
  supabase: Awaited<ReturnType<typeof createClient>>,
  companyId: string,
  actorId: string,
  actionType: ActivityActionType,
  description: string,
  targetId?: string | null,
): Promise<void> {
  const { error } = await supabase.from("activity_log").insert({
    company_id: companyId,
    actor_id: actorId,
    action_type: actionType,
    description,
    target_id: targetId ?? null,
  });
  if (error) console.error("activity_log insert failed:", error.message);
}
