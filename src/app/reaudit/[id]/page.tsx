import type { Metadata } from "next";
import { supabaseAdmin } from "@/lib/supabase";
import { getCurrentTools, getCurrentPricingSnapshot } from "@/lib/current-pricing";
import { diffPricingSnapshots } from "@/lib/pricing-data";
import { runAudit } from "@/lib/audit-engine";
import ReauditClient from "./ReauditClient";
import type { AuditInput, ToolRecommendation } from "@/types";

interface ReauditPageProps {
  params: { id: string };
}

export const metadata: Metadata = {
  title: "Re-Audit — Updated AI Pricing | StackAudit",
  description:
    "See how pricing changes affect your AI spend audit — old vs new recommendations side by side.",
};

export default async function ReauditPage({ params }: ReauditPageProps) {
  const { id } = params;

  // Fetch original audit from Supabase
  const { data: audit, error } = await supabaseAdmin
    .from("audits")
    .select(
      "id, input, recommendations, total_monthly_savings, total_annual_savings, pricing_snapshot, created_at"
    )
    .eq("id", id)
    .single();

  if (error || !audit) {
    return (
      <div className="min-h-screen bg-dark flex items-center justify-center">
        <div className="text-center">
          <p className="text-xl font-semibold text-white mb-2">Audit not found</p>
          <p className="text-gray-400">This audit ID does not exist or has been removed.</p>
          <a href="/" className="mt-6 inline-block text-green-400 underline">
            Run a new audit
          </a>
        </div>
      </div>
    );
  }

  // Load current pricing (with any active overrides)
  const currentTools = await getCurrentTools();
  const currentSnapshot = await getCurrentPricingSnapshot();

  // Re-run the audit engine with current pricing
  const input = audit.input as AuditInput;
  const newResult = runAudit(input, currentTools);

  // Compute which prices actually changed
  const storedSnapshot = (audit.pricing_snapshot as Record<string, number>) ?? {};
  const rawChanges = diffPricingSnapshots(storedSnapshot, currentSnapshot);

  // Filter to only plans used in this audit
  const usedPlanIds = new Set(input.tools.map((t) => t.planId));
  const pricingChanges = rawChanges
    .filter((c) => usedPlanIds.has(c.planId))
    .map((c) => {
      const tool = currentTools.find((t) =>
        t.plans.some((p) => p.id === c.planId)
      );
      const plan = tool?.plans.find((p) => p.id === c.planId);
      return {
        planId: c.planId,
        planName: plan?.name ?? c.planId,
        toolName: tool?.name ?? c.planId,
        oldPrice: c.oldPrice,
        newPrice: c.newPrice,
      };
    });

  return (
    <ReauditClient
      auditId={id}
      createdAt={audit.created_at}
      oldRecommendations={audit.recommendations as ToolRecommendation[]}
      oldTotalSavings={Number(audit.total_monthly_savings)}
      newRecommendations={newResult.recommendations}
      newTotalSavings={newResult.totalMonthlySavings}
      pricingChanges={pricingChanges}
    />
  );
}
