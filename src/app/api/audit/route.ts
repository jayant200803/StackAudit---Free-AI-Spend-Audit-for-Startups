import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getPricingSnapshot } from "@/lib/pricing-data";
import type { AuditResult } from "@/types";

/**
 * POST /api/audit
 * Persists an audit result to Supabase for shareable URLs.
 * Round 2: also stores pricing_snapshot so we can detect when prices change.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const result: AuditResult = body;

    if (
      !process.env.NEXT_PUBLIC_SUPABASE_URL ||
      !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    ) {
      return NextResponse.json({ saved: false, reason: "supabase_not_configured" });
    }

    const { error } = await supabase.from("audits").insert({
      id: result.id,
      input: result.input,
      recommendations: result.recommendations,
      total_current_spend: result.totalCurrentSpend,
      total_optimized_spend: result.totalOptimizedSpend,
      total_monthly_savings: result.totalMonthlySavings,
      total_annual_savings: result.totalAnnualSavings,
      credex_savings_estimate: result.credexSavingsEstimate,
      ai_summary: result.aiSummary || "",
      // Round 2: snapshot the pricing used at audit time
      pricing_snapshot: getPricingSnapshot(),
    });

    if (error) {
      console.error("Supabase insert error:", error);
      return NextResponse.json(
        { saved: false, reason: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ saved: true, id: result.id });
  } catch (error) {
    console.error("Audit save failed:", error);
    return NextResponse.json(
      { saved: false, reason: "server_error" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/audit?id=<uuid>
 * Retrieves a saved audit for the /share/[id] page.
 */
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    return NextResponse.json(
      { error: "Database not configured" },
      { status: 503 }
    );
  }

  const { data, error } = await supabase
    .from("audits")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Audit not found" }, { status: 404 });
  }

  return NextResponse.json({
    id: data.id,
    input: data.input,
    recommendations: data.recommendations,
    totalCurrentSpend: data.total_current_spend,
    totalOptimizedSpend: data.total_optimized_spend,
    totalMonthlySavings: data.total_monthly_savings,
    totalAnnualSavings: data.total_annual_savings,
    aiSummary: data.ai_summary,
    createdAt: data.created_at,
  });
}
