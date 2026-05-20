/**
 * Server-side utility: loads the current pricing, applying any overrides
 * stored in the Supabase pricing_overrides table.
 *
 * Usage: only import this in API routes (server-side), never in client components.
 */
import { supabaseAdmin } from "./supabase";
import {
  AI_TOOLS,
  applyPricingOverrides,
  getPricingSnapshot,
} from "./pricing-data";
import type { AITool } from "@/types";

export interface PricingOverride {
  plan_id: string;
  tool_id: string;
  price_per_seat: number;
  updated_at: string;
}

/**
 * Fetches overrides from Supabase and returns the full tools list
 * with any overridden prices applied.
 */
export async function getCurrentTools(): Promise<AITool[]> {
  try {
    const { data, error } = await supabaseAdmin
      .from("pricing_overrides")
      .select("plan_id, price_per_seat");

    if (error || !data || data.length === 0) return AI_TOOLS;

    const overrideMap: Record<string, number> = {};
    for (const row of data) {
      overrideMap[row.plan_id] = Number(row.price_per_seat);
    }
    return applyPricingOverrides(overrideMap);
  } catch {
    // If table doesn't exist yet, fall back to static data
    return AI_TOOLS;
  }
}

/**
 * Returns the current pricing snapshot, including any active overrides.
 */
export async function getCurrentPricingSnapshot(): Promise<
  Record<string, number>
> {
  const tools = await getCurrentTools();
  const snapshot: Record<string, number> = {};
  for (const tool of tools) {
    for (const plan of tool.plans) {
      snapshot[plan.id] = plan.pricePerSeat;
    }
  }
  return snapshot;
}

/**
 * Returns all active pricing overrides from Supabase.
 */
export async function getActiveOverrides(): Promise<PricingOverride[]> {
  try {
    const { data } = await supabaseAdmin
      .from("pricing_overrides")
      .select("*")
      .order("updated_at", { ascending: false });
    return data || [];
  } catch {
    return [];
  }
}
