"use client";

import type { ToolRecommendation } from "@/types";

interface PricingChange {
  planId: string;
  planName: string;
  toolName: string;
  oldPrice: number;
  newPrice: number;
}

interface ReauditClientProps {
  auditId: string;
  createdAt: string;
  oldRecommendations: ToolRecommendation[];
  oldTotalSavings: number;
  newRecommendations: ToolRecommendation[];
  newTotalSavings: number;
  pricingChanges: PricingChange[];
}

export default function ReauditClient({
  auditId,
  createdAt,
  oldRecommendations,
  oldTotalSavings,
  newRecommendations,
  newTotalSavings,
  pricingChanges,
}: ReauditClientProps) {
  const savingsDelta = newTotalSavings - oldTotalSavings;
  const auditDate = new Date(createdAt).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  // Map toolId → new recommendation for quick lookup
  const newRecMap = new Map(newRecommendations.map((r) => [r.toolId, r]));

  const hasChanges = pricingChanges.length > 0;

  return (
    <div className="min-h-screen bg-dark text-white">
      {/* ── Header ── */}
      <div className="border-b border-white/10 bg-dark2">
        <div className="max-w-4xl mx-auto px-4 py-5 flex items-center justify-between">
          <a href="/" className="text-green-400 font-bold text-lg tracking-tight">
            StackAudit
          </a>
          <a
            href="/"
            className="text-sm text-gray-400 hover:text-white transition-colors"
          >
            ← Run new audit
          </a>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-10">
        {/* ── Banner ── */}
        <div className="mb-8">
          <div className="inline-block bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 text-xs font-semibold px-3 py-1 rounded-full mb-4">
            RE-AUDIT — PRICING UPDATED
          </div>
          <h1 className="text-3xl font-bold mb-2">
            What changed since your audit
          </h1>
          <p className="text-gray-400 text-sm">
            Original audit: {auditDate} &nbsp;·&nbsp; ID:{" "}
            <span className="font-mono text-xs">{auditId.slice(0, 8)}…</span>
          </p>
        </div>

        {/* ── Pricing changes ── */}
        {hasChanges ? (
          <div className="bg-dark2 border border-white/10 rounded-xl p-5 mb-8">
            <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">
              Price changes detected
            </h2>
            <div className="space-y-3">
              {pricingChanges.map((c) => {
                const up = c.newPrice > c.oldPrice;
                const delta = c.newPrice - c.oldPrice;
                return (
                  <div
                    key={c.planId}
                    className="flex items-center justify-between"
                  >
                    <div>
                      <span className="font-semibold">{c.toolName}</span>
                      <span className="text-gray-500 text-sm ml-2">
                        {c.planName}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-sm">
                      <span className="text-gray-400 line-through">
                        ${c.oldPrice}/seat
                      </span>
                      <span className="text-white font-semibold">
                        ${c.newPrice}/seat
                      </span>
                      <span
                        className={`font-bold ${
                          up ? "text-red-400" : "text-green-400"
                        }`}
                      >
                        {up ? "+" : ""}${delta}/seat
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-5 mb-8">
            <p className="text-green-400 font-semibold">
              ✓ No pricing changes affect your specific tools.
            </p>
            <p className="text-gray-400 text-sm mt-1">
              Your original audit recommendations are still current.
            </p>
          </div>
        )}

        {/* ── Savings delta headline ── */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-dark2 border border-white/10 rounded-xl p-5 text-center">
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">
              Original savings
            </p>
            <p className="text-2xl font-bold">
              ${oldTotalSavings.toLocaleString()}
              <span className="text-sm font-normal text-gray-400">/mo</span>
            </p>
          </div>
          <div className="bg-dark2 border border-white/10 rounded-xl p-5 text-center">
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">
              Updated savings
            </p>
            <p className="text-2xl font-bold text-green-400">
              ${newTotalSavings.toLocaleString()}
              <span className="text-sm font-normal text-gray-400">/mo</span>
            </p>
          </div>
          <div
            className={`border rounded-xl p-5 text-center ${
              savingsDelta >= 0
                ? "bg-green-500/10 border-green-500/30"
                : "bg-red-500/10 border-red-500/30"
            }`}
          >
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">
              Change
            </p>
            <p
              className={`text-2xl font-bold ${
                savingsDelta >= 0 ? "text-green-400" : "text-red-400"
              }`}
            >
              {savingsDelta >= 0 ? "+" : ""}${savingsDelta.toLocaleString()}
              <span className="text-sm font-normal text-gray-400">/mo</span>
            </p>
          </div>
        </div>

        {/* ── Diff table ── */}
        <h2 className="text-lg font-bold mb-4">Recommendation diff</h2>
        <div className="space-y-3">
          {oldRecommendations.map((old) => {
            const updated = newRecMap.get(old.toolId);
            const changed =
              updated &&
              (old.action !== updated.action ||
                old.recommendedPlan !== updated.recommendedPlan ||
                Math.abs(old.monthlySavings - updated.monthlySavings) > 0.5);

            return (
              <div
                key={old.toolId}
                className={`rounded-xl border p-5 transition-all ${
                  changed
                    ? "border-yellow-500/40 bg-yellow-500/5"
                    : "border-white/10 bg-dark2 opacity-60"
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <span className="font-semibold">{old.toolName}</span>
                    <span className="text-xs text-gray-500">{old.currentPlan}</span>
                  </div>
                  {changed ? (
                    <span className="text-xs font-bold bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded-full">
                      CHANGED
                    </span>
                  ) : (
                    <span className="text-xs font-bold bg-white/10 text-gray-500 px-2 py-0.5 rounded-full">
                      SAME
                    </span>
                  )}
                </div>

                {/* Before */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-black/30 rounded-lg p-3">
                    <p className="text-xs text-gray-500 mb-1">Before</p>
                    <p className="text-sm font-semibold">
                      {old.action === "keep"
                        ? "No change"
                        : old.recommendedPlan ?? old.recommendedTool ?? old.action}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Save ${old.monthlySavings.toLocaleString()}/mo
                    </p>
                  </div>
                  {/* After */}
                  <div
                    className={`rounded-lg p-3 ${
                      changed ? "bg-green-500/10" : "bg-black/30"
                    }`}
                  >
                    <p className="text-xs text-gray-500 mb-1">After</p>
                    {updated ? (
                      <>
                        <p
                          className={`text-sm font-semibold ${
                            changed ? "text-green-400" : ""
                          }`}
                        >
                          {updated.action === "keep"
                            ? "No change"
                            : updated.recommendedPlan ??
                              updated.recommendedTool ??
                              updated.action}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          Save ${updated.monthlySavings.toLocaleString()}/mo
                        </p>
                      </>
                    ) : (
                      <p className="text-sm text-gray-500">—</p>
                    )}
                  </div>
                </div>

                {/* Show new reason if changed */}
                {changed && updated && (
                  <p className="text-xs text-gray-400 mt-3 border-t border-white/5 pt-3">
                    {updated.reason}
                  </p>
                )}
              </div>
            );
          })}
        </div>

        {/* ── CTA ── */}
        <div className="mt-10 bg-green-500/10 border border-green-500/30 rounded-xl p-6 text-center">
          <p className="text-green-400 font-bold text-lg mb-1">
            Run a fresh audit with today&apos;s pricing
          </p>
          <p className="text-gray-400 text-sm mb-4">
            Takes 60 seconds. No account needed.
          </p>
          <a
            href="/"
            className="inline-block bg-green-500 hover:bg-green-600 text-white font-semibold px-6 py-3 rounded-xl transition-colors"
          >
            Start New Audit →
          </a>
        </div>
      </div>
    </div>
  );
}
