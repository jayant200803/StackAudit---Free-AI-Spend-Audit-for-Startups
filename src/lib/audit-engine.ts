import {
  AuditInput,
  AuditResult,
  AITool,
  ToolEntry,
  ToolRecommendation,
  RecommendationAction,
  UseCase,
} from "@/types";
import { AI_TOOLS, getToolById, CREDEX_DISCOUNT_RATE } from "./pricing-data";
import { v4 as uuidv4 } from "uuid";

/** Looks up a tool by ID from a provided tools array (or falls back to default). */
function getToolFrom(
  id: string,
  tools: AITool[]
): AITool | undefined {
  return tools.find((t) => t.id === id);
}

// ─── Rule Engine ───

/**
 * Core audit logic. Hardcoded rules, not AI — knowing when NOT to use AI
 * is part of the test. Each rule is defensible and usage-fit based.
 */
/**
 * Core audit logic.
 * @param input - The user's tool stack and team info.
 * @param customTools - Optional: pass a modified tools list (e.g. with price overrides applied)
 *                      for the re-audit diff view. Defaults to the static AI_TOOLS.
 */
export function runAudit(input: AuditInput, customTools?: AITool[]): AuditResult {
  const tools = customTools ?? AI_TOOLS;
  const recommendations: ToolRecommendation[] = input.tools.map((entry) =>
    evaluateTool(entry, input.teamSize, input.primaryUseCase, tools)
  );

  const totalCurrentSpend = recommendations.reduce(
    (sum, r) => sum + r.currentSpend,
    0
  );
  const totalOptimizedSpend = recommendations.reduce(
    (sum, r) => sum + r.newSpend,
    0
  );
  const totalMonthlySavings = totalCurrentSpend - totalOptimizedSpend;
  const totalAnnualSavings = totalMonthlySavings * 12;

  // Credex savings: additional discount on tools where bulk credits apply
  const credexEligibleSpend = recommendations
    .filter((r) => r.action !== "keep")
    .reduce((sum, r) => sum + r.newSpend, 0);
  const credexSavingsEstimate = Math.round(
    credexEligibleSpend * CREDEX_DISCOUNT_RATE
  );

  return {
    id: uuidv4(),
    input,
    recommendations,
    totalCurrentSpend,
    totalOptimizedSpend,
    totalMonthlySavings: Math.max(0, totalMonthlySavings),
    totalAnnualSavings: Math.max(0, totalAnnualSavings),
    credexSavingsEstimate,
    aiSummary: "", // filled by AI step or fallback
    createdAt: new Date().toISOString(),
  };
}

function evaluateTool(
  entry: ToolEntry,
  teamSize: number,
  useCase: UseCase,
  tools: AITool[] = AI_TOOLS
): ToolRecommendation {
  const tool = getToolFrom(entry.toolId, tools);
  if (!tool) {
    return makeKeepRec(entry, "Unknown tool — no recommendation available.");
  }

  const currentPlan = tool.plans.find((p) => p.id === entry.planId);
  if (!currentPlan) {
    return makeKeepRec(entry, "Unknown plan — no recommendation available.");
  }

  const currentSpend = entry.monthlySpend;
  const seats = entry.seats;

  // ── Rule 1: Overpaying for team plans with few seats ──
  if (currentPlan.minRecommendedSeats && seats < currentPlan.minRecommendedSeats) {
    const individualPlan = findCheaperIndividualPlan(tool, currentPlan, seats);
    if (individualPlan) {
      const newSpend = individualPlan.pricePerSeat * seats;
      if (newSpend < currentSpend) {
        return {
          toolId: entry.toolId,
          toolName: tool.name,
          currentPlan: currentPlan.name,
          currentSpend,
          action: "downgrade",
          recommendedPlan: individualPlan.name,
          newSpend,
          monthlySavings: currentSpend - newSpend,
          reason: `Team/Enterprise plan is overkill for ${seats} seat${seats === 1 ? "" : "s"}. Individual ${individualPlan.name} plan covers the same needs at lower cost.`,
          confidence: "high",
        };
      }
    }
  }

  // ── Rule 2: On expensive tier when cheaper tier fits the use case ──
  const cheaperSameTool = findCheaperFittingPlan(
    tool,
    currentPlan,
    seats,
    useCase,
    currentSpend
  );
  if (cheaperSameTool) {
    const newSpend = cheaperSameTool.pricePerSeat * seats;
    return {
      toolId: entry.toolId,
      toolName: tool.name,
      currentPlan: currentPlan.name,
      currentSpend,
      action: "switch_plan",
      recommendedPlan: cheaperSameTool.name,
      newSpend,
      monthlySavings: currentSpend - newSpend,
      reason: getSwitchPlanReason(
        tool.name,
        currentPlan.name,
        cheaperSameTool.name,
        seats,
        useCase
      ),
      confidence: "medium",
    };
  }

  // ── Rule 3: Cheaper cross-tool alternative ──
  const alternative = findCheaperAlternative(
    entry,
    currentPlan,
    teamSize,
    useCase,
    tools
  );
  if (alternative) {
    return alternative;
  }

  // ── Rule 4: Credex credits savings (retail vs. bulk) ──
  if (currentSpend > 100 && tool.category !== "api") {
    const credexSavings = Math.round(currentSpend * CREDEX_DISCOUNT_RATE);
    if (credexSavings >= 10) {
      return {
        toolId: entry.toolId,
        toolName: tool.name,
        currentPlan: currentPlan.name,
        currentSpend,
        action: "use_credits",
        newSpend: currentSpend - credexSavings,
        monthlySavings: credexSavings,
        reason: `You're paying retail. Credex sources discounted credits for ${tool.name} — estimated ~${Math.round(CREDEX_DISCOUNT_RATE * 100)}% savings on your current plan spend.`,
        confidence: "medium",
      };
    }
  }

  // ── Rule 5: API spend optimization ──
  if (tool.category === "api" && currentSpend > 200) {
    const batchSavings = Math.round(currentSpend * 0.15); // batch API typically 50% off on eligible workloads; conservatively 15% of total
    return {
      toolId: entry.toolId,
      toolName: tool.name,
      currentPlan: currentPlan.name,
      currentSpend,
      action: "use_credits",
      newSpend: currentSpend - batchSavings,
      monthlySavings: batchSavings,
      reason: `High API spend detected. Batch API processing (50% off) for non-time-sensitive workloads, prompt caching, and model routing to cheaper tiers can reduce costs. Credex can also source discounted API credits.`,
      confidence: "medium",
    };
  }

  // ── No action — spending well ──
  return makeKeepRec(
    entry,
    `${currentPlan.name} is well-suited for your use case with ${seats} seat${seats === 1 ? "" : "s"}. No change recommended.`,
    tool.name,
    currentPlan.name
  );
}

// ─── Helper: find cheaper individual plan ───
function findCheaperIndividualPlan(
  tool: typeof AI_TOOLS[number],
  currentPlan: typeof AI_TOOLS[number]["plans"][number],
  seats: number
) {
  return tool.plans
    .filter(
      (p) =>
        !p.minRecommendedSeats &&
        p.pricePerSeat > 0 &&
        p.pricePerSeat * seats < currentPlan.pricePerSeat * seats
    )
    .sort((a, b) => b.pricePerSeat - a.pricePerSeat)[0]; // most capable but cheaper
}

// ─── Helper: find cheaper plan from same vendor ───
function findCheaperFittingPlan(
  tool: typeof AI_TOOLS[number],
  currentPlan: typeof AI_TOOLS[number]["plans"][number],
  seats: number,
  useCase: UseCase,
  currentSpend: number
) {
  // For power-user tiers (Ultra/$200+), check if mid-tier suffices
  if (currentPlan.pricePerSeat >= 100) {
    const midTier = tool.plans.find(
      (p) =>
        p.pricePerSeat > 0 &&
        p.pricePerSeat < currentPlan.pricePerSeat &&
        p.pricePerSeat >= 15 &&
        !p.minRecommendedSeats
    );
    if (midTier && midTier.pricePerSeat * seats < currentSpend) {
      return midTier;
    }
  }

  // For team plans where team size is small, individual plans may work
  if (currentPlan.minRecommendedSeats && seats <= 3) {
    const proPlan = tool.plans.find(
      (p) => p.pricePerSeat > 0 && p.pricePerSeat <= 20 && !p.minRecommendedSeats
    );
    if (proPlan && proPlan.pricePerSeat * seats < currentSpend) {
      return proPlan;
    }
  }

  return null;
}

// ─── Helper: cross-tool alternative ───
function findCheaperAlternative(
  entry: ToolEntry,
  currentPlan: typeof AI_TOOLS[number]["plans"][number],
  teamSize: number,
  useCase: UseCase,
  tools: AITool[] = AI_TOOLS
): ToolRecommendation | null {
  const tool = getToolFrom(entry.toolId, tools)!;
  const currentSpend = entry.monthlySpend;
  const seats = entry.seats;

  // IDE alternatives: Cursor ↔ GitHub Copilot ↔ Windsurf
  if (tool.category === "ide") {
    // If on Cursor Pro+ or higher (not base Pro) and use case is primarily simple coding
    if (
      entry.toolId === "cursor" &&
      currentPlan.pricePerSeat > 20 &&  // Only for Pro+ and above, not base Pro
      useCase === "coding"
    ) {
      const copilotPro = 10; // GitHub Copilot Pro
      const newSpend = copilotPro * seats;
      if (newSpend < currentSpend * 0.5) {
        // Only recommend if >50% savings (meaningful threshold)
        return {
          toolId: entry.toolId,
          toolName: tool.name,
          currentPlan: currentPlan.name,
          currentSpend,
          action: "switch_tool",
          recommendedTool: "GitHub Copilot Pro",
          newSpend,
          monthlySavings: currentSpend - newSpend,
          reason: `If your primary need is code completions and inline suggestions, GitHub Copilot Pro at $10/user/mo provides comparable autocomplete at half the cost. Cursor's agent mode and multi-file editing are stronger — only switch if those aren't critical to your workflow.`,
          confidence: "low",
        };
      }
    }

    // If on GitHub Copilot Enterprise and team is small
    if (
      entry.toolId === "github-copilot" &&
      currentPlan.id === "copilot-enterprise" &&
      seats < 20
    ) {
      const businessSpend = 19 * seats;
      if (businessSpend < currentSpend * 0.8) {
        return {
          toolId: entry.toolId,
          toolName: tool.name,
          currentPlan: currentPlan.name,
          currentSpend,
          action: "switch_plan",
          recommendedPlan: "Business",
          newSpend: businessSpend,
          monthlySavings: currentSpend - businessSpend,
          reason: `Enterprise features (knowledge bases, GitHub.com integration) may not be fully utilized with a ${seats}-person team. Business plan at $19/user/mo covers organizational needs.`,
          confidence: "medium",
        };
      }
    }
  }

  // Assistant alternatives: Claude ↔ ChatGPT ↔ Gemini
  if (tool.category === "assistant") {
    // ChatGPT Pro ($200) → Claude Pro ($20) or ChatGPT Plus ($20) for non-power users
    if (
      entry.toolId === "chatgpt" &&
      currentPlan.pricePerSeat >= 200 &&
      useCase !== "research"
    ) {
      const newSpend = 20 * seats;
      if (newSpend < currentSpend * 0.3) {
        return {
          toolId: entry.toolId,
          toolName: tool.name,
          currentPlan: currentPlan.name,
          currentSpend,
          action: "switch_plan",
          recommendedPlan: "Plus",
          newSpend,
          monthlySavings: currentSpend - newSpend,
          reason: `Pro's 20x limits and 1M context are designed for power users doing daily deep research. If your usage doesn't regularly hit Plus limits, the $180/seat/mo premium isn't justified.`,
          confidence: "medium",
        };
      }
    }

    // Gemini Ultra ($250) → Gemini Pro ($20) for most use cases
    if (
      entry.toolId === "gemini" &&
      currentPlan.id === "gemini-ultra"
    ) {
      const proSpend = 20 * seats;
      return {
        toolId: entry.toolId,
        toolName: tool.name,
        currentPlan: currentPlan.name,
        currentSpend,
        action: "switch_plan",
        recommendedPlan: "AI Pro",
        newSpend: proSpend,
        monthlySavings: currentSpend - proSpend,
        reason: `AI Ultra at $250/mo includes YouTube Premium, 30TB storage, and Veo 3.1 — bundled perks that inflate the price. If your core need is AI assistance, Pro at $20/mo gives you Gemini 3.1 Pro with 1,000 credits and Workspace integration.`,
        confidence: "high",
      };
    }
  }

  return null;
}

// ─── Switch plan reasoning ───
function getSwitchPlanReason(
  toolName: string,
  fromPlan: string,
  toPlan: string,
  seats: number,
  useCase: UseCase
): string {
  const reasons: Record<string, string> = {
    "Cursor": `Most developers don't exhaust ${fromPlan}'s included credits. ${toPlan} covers typical daily usage (autocomplete + occasional agent tasks) at a lower price point.`,
    "GitHub Copilot": `For ${seats} developer${seats === 1 ? "" : "s"} doing ${useCase}, ${toPlan} provides the same core completions and chat capabilities at a better price-to-usage ratio.`,
    "Claude": `${fromPlan} provides ${fromPlan.includes("20x") ? "100x" : "25x"} Free capacity — overkill unless you're hitting limits daily. ${toPlan} is sufficient for most ${useCase} workflows.`,
    "ChatGPT": `${toPlan} includes GPT-5.5, Deep Research, and Agent Mode — the features most users need. ${fromPlan}'s higher limits justify the premium only for daily power users.`,
  };
  return (
    reasons[toolName] ||
    `${toPlan} fits your ${useCase} use case at a lower cost than ${fromPlan} for ${seats} seat${seats === 1 ? "" : "s"}.`
  );
}

// ─── Keep recommendation (no change) ───
function makeKeepRec(
  entry: ToolEntry,
  reason: string,
  toolName?: string,
  planName?: string,
  tools: AITool[] = AI_TOOLS
): ToolRecommendation {
  const tool = getToolFrom(entry.toolId, tools);
  const currentPlan = tool?.plans.find((p) => p.id === entry.planId);
  return {
    toolId: entry.toolId,
    toolName: toolName || tool?.name || entry.toolId,
    currentPlan: planName || currentPlan?.name || entry.planId,
    currentSpend: entry.monthlySpend,
    action: "keep",
    newSpend: entry.monthlySpend,
    monthlySavings: 0,
    reason,
    confidence: "high",
  };
}

// ─── Generate fallback summary when AI is unavailable ───
export function generateFallbackSummary(result: AuditResult): string {
  const { recommendations, totalMonthlySavings, totalAnnualSavings, input } =
    result;
  const actionable = recommendations.filter((r) => r.action !== "keep");

  if (actionable.length === 0) {
    return `Your AI tool stack is well-optimized for a ${input.teamSize}-person team focused on ${input.primaryUseCase}. You're on the right plans for your usage level, and there are no immediate savings to capture. We'll notify you if pricing changes create new optimization opportunities.`;
  }

  const topSaving = actionable.sort(
    (a, b) => b.monthlySavings - a.monthlySavings
  )[0];

  return `Your ${input.teamSize}-person team is spending more than necessary on AI tools. The biggest opportunity: ${topSaving.toolName} (${topSaving.currentPlan}) — ${topSaving.reason.split(".")[0].toLowerCase()}. Across all tools, you could save approximately $${totalMonthlySavings.toLocaleString()}/month ($${totalAnnualSavings.toLocaleString()}/year) by right-sizing plans to match your actual ${input.primaryUseCase} usage.`;
}
