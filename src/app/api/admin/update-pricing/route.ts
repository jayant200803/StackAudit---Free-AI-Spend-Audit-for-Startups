import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { z } from "zod";

const UpdatePricingSchema = z.object({
  planId: z.string().min(1),
  toolId: z.string().min(1),
  newPrice: z.number().min(0),
});

/**
 * POST /api/admin/update-pricing
 *
 * Admin-only endpoint to simulate a pricing change.
 * Protected by the ADMIN_SECRET environment variable.
 *
 * Example body:
 * {
 *   "planId": "cursor-pro",
 *   "toolId": "cursor",
 *   "newPrice": 25
 * }
 *
 * Requires header: x-admin-secret: <ADMIN_SECRET env var>
 *
 * After calling this, run POST /api/detect-changes to find affected audits
 * and send notification emails.
 */
export async function POST(req: NextRequest) {
  // Auth check
  const adminSecret = process.env.ADMIN_SECRET;
  const providedSecret = req.headers.get("x-admin-secret");

  if (!adminSecret || providedSecret !== adminSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = UpdatePricingSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message || "Invalid input" },
      { status: 400 }
    );
  }

  const { planId, toolId, newPrice } = parsed.data;

  const { error } = await supabaseAdmin.from("pricing_overrides").upsert(
    {
      plan_id: planId,
      tool_id: toolId,
      price_per_seat: newPrice,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "plan_id" }
  );

  if (error) {
    console.error("Failed to update pricing override:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    updated: true,
    planId,
    toolId,
    newPrice,
    message: `Price for ${planId} set to $${newPrice}/seat. Run POST /api/detect-changes to notify affected users.`,
  });
}

/**
 * DELETE /api/admin/update-pricing
 * Removes a pricing override, reverting to the default from pricing-data.ts.
 */
export async function DELETE(req: NextRequest) {
  const adminSecret = process.env.ADMIN_SECRET;
  const providedSecret = req.headers.get("x-admin-secret");

  if (!adminSecret || providedSecret !== adminSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { planId } = await req.json();

  if (!planId) {
    return NextResponse.json({ error: "planId required" }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from("pricing_overrides")
    .delete()
    .eq("plan_id", planId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ deleted: true, planId });
}
