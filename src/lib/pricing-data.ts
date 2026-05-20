import { AITool } from "@/types";

/**
 * Pricing data for all supported AI tools.
 * Every price traces to an official vendor URL — see PRICING_DATA.md.
 * Last verified: submission week (see PRICING_DATA.md for exact dates).
 */
export const AI_TOOLS: AITool[] = [
  // ─── AI Code Editors ───
  {
    id: "cursor",
    name: "Cursor",
    category: "ide",
    icon: "⌨️",
    website: "https://cursor.com/pricing",
    plans: [
      {
        id: "cursor-hobby",
        name: "Hobby (Free)",
        pricePerSeat: 0,
        features: ["Limited completions", "Limited agent requests"],
      },
      {
        id: "cursor-pro",
        name: "Pro",
        pricePerSeat: 20,
        features: [
          "Unlimited Tab completions",
          "Extended agent limits",
          "$20 frontier model credits",
          "Cloud agents",
        ],
      },
      {
        id: "cursor-pro-plus",
        name: "Pro+",
        pricePerSeat: 60,
        features: [
          "Everything in Pro",
          "3x usage on all models",
        ],
      },
      {
        id: "cursor-ultra",
        name: "Ultra",
        pricePerSeat: 200,
        features: [
          "Everything in Pro",
          "20x usage on all models",
          "Priority access to new features",
        ],
      },
      {
        id: "cursor-business",
        name: "Business",
        pricePerSeat: 40,
        features: [
          "Pro-equivalent AI",
          "Admin controls",
          "Centralized billing",
          "Usage analytics",
          "SAML/OIDC SSO",
        ],
        minRecommendedSeats: 5,
      },
      {
        id: "cursor-enterprise",
        name: "Enterprise",
        pricePerSeat: 40, // base; custom pricing in practice
        features: [
          "Everything in Business",
          "Invoice billing",
          "Pooled usage",
          "Advanced security",
        ],
        minRecommendedSeats: 20,
      },
    ],
  },
  {
    id: "github-copilot",
    name: "GitHub Copilot",
    category: "ide",
    icon: "🐙",
    website: "https://github.com/features/copilot/plans",
    plans: [
      {
        id: "copilot-free",
        name: "Free",
        pricePerSeat: 0,
        features: ["2000 completions/mo", "50 chat requests/mo"],
      },
      {
        id: "copilot-pro",
        name: "Pro",
        pricePerSeat: 10,
        features: [
          "Unlimited completions",
          "Premium model requests",
          "$10 monthly AI credits",
        ],
      },
      {
        id: "copilot-pro-plus",
        name: "Pro+",
        pricePerSeat: 39,
        features: [
          "Everything in Pro",
          "5x premium requests",
          "$39 monthly AI credits",
          "All available models",
        ],
      },
      {
        id: "copilot-business",
        name: "Business",
        pricePerSeat: 19,
        features: [
          "Organization management",
          "Policy controls",
          "IP indemnity",
          "$19 monthly AI credits",
        ],
        minRecommendedSeats: 5,
      },
      {
        id: "copilot-enterprise",
        name: "Enterprise",
        pricePerSeat: 39,
        features: [
          "Everything in Business",
          "GitHub.com integration",
          "Knowledge bases",
          "$39 monthly AI credits",
        ],
        minRecommendedSeats: 20,
      },
    ],
  },
  {
    id: "windsurf",
    name: "Windsurf",
    category: "ide",
    icon: "🏄",
    website: "https://windsurf.com/pricing",
    plans: [
      {
        id: "windsurf-free",
        name: "Free",
        pricePerSeat: 0,
        features: [
          "Limited Cascade sessions",
          "Unlimited Tab completions",
        ],
      },
      {
        id: "windsurf-pro",
        name: "Pro",
        pricePerSeat: 20,
        features: [
          "Standard quota with daily/weekly refresh",
          "All premium models",
          "Unlimited Tab & Command",
        ],
      },
      {
        id: "windsurf-max",
        name: "Max",
        pricePerSeat: 200,
        features: [
          "Heavy daily/weekly quota",
          "All premium models",
          "Priority access",
        ],
      },
      {
        id: "windsurf-teams",
        name: "Teams",
        pricePerSeat: 40,
        features: [
          "Centralized billing",
          "Admin controls",
          "SSO",
          "Usage analytics",
        ],
        minRecommendedSeats: 3,
      },
    ],
  },

  // ─── AI Assistants ───
  {
    id: "claude",
    name: "Claude",
    category: "assistant",
    icon: "🧠",
    website: "https://claude.com/pricing",
    plans: [
      {
        id: "claude-free",
        name: "Free",
        pricePerSeat: 0,
        features: [
          "Daily usage limits",
          "Sonnet & Haiku access",
          "Web search",
        ],
      },
      {
        id: "claude-pro",
        name: "Pro",
        pricePerSeat: 20,
        features: [
          "5x Free usage",
          "All models incl. Opus",
          "Claude Code",
          "Cowork",
          "Projects",
        ],
      },
      {
        id: "claude-max-5x",
        name: "Max 5x",
        pricePerSeat: 100,
        features: [
          "5x Pro usage (25x Free)",
          "Priority access",
          "Full Claude Code",
        ],
      },
      {
        id: "claude-max-20x",
        name: "Max 20x",
        pricePerSeat: 200,
        features: [
          "20x Pro usage (100x Free)",
          "Zero-latency priority",
          "Full Claude Code",
        ],
      },
      {
        id: "claude-team-standard",
        name: "Team Standard",
        pricePerSeat: 25,
        features: [
          "1.25x Pro usage",
          "Slack/M365 integration",
          "SSO & admin controls",
        ],
        minRecommendedSeats: 5,
      },
      {
        id: "claude-team-premium",
        name: "Team Premium",
        pricePerSeat: 100,
        features: [
          "6.25x Pro usage",
          "Claude Code included",
          "Cowork included",
        ],
        minRecommendedSeats: 5,
      },
      {
        id: "claude-enterprise",
        name: "Enterprise",
        pricePerSeat: 60, // estimated starting; custom pricing
        features: [
          "500K context window",
          "HIPAA readiness",
          "SAML SSO",
          "Audit logs",
          "API-rate token billing",
        ],
        minRecommendedSeats: 50,
      },
    ],
  },
  {
    id: "chatgpt",
    name: "ChatGPT",
    category: "assistant",
    icon: "💬",
    website: "https://openai.com/chatgpt/pricing",
    plans: [
      {
        id: "chatgpt-free",
        name: "Free",
        pricePerSeat: 0,
        features: [
          "10 messages/5 hours",
          "GPT-5.3 Instant",
          "Ads in US",
        ],
      },
      {
        id: "chatgpt-plus",
        name: "Plus",
        pricePerSeat: 20,
        features: [
          "GPT-5.5 access",
          "Deep Research (10/mo)",
          "Sora, Codex, Agent Mode",
        ],
      },
      {
        id: "chatgpt-pro-100",
        name: "Pro ($100)",
        pricePerSeat: 100,
        features: [
          "5x Plus limits",
          "GPT-5.5 Pro",
          "1M token context",
        ],
      },
      {
        id: "chatgpt-pro-200",
        name: "Pro ($200)",
        pricePerSeat: 200,
        features: [
          "20x Plus limits",
          "1M token context",
          "250 Deep Research runs/mo",
        ],
      },
      {
        id: "chatgpt-team",
        name: "Team",
        pricePerSeat: 25,
        features: [
          "GPT-5.5 access",
          "Shared workspace",
          "Admin console",
        ],
        minRecommendedSeats: 2,
      },
      {
        id: "chatgpt-business",
        name: "Business",
        pricePerSeat: 20,
        features: [
          "GPT-5.5 & GPT-5.5 Pro",
          "Centralized billing",
          "Usage analytics",
        ],
        minRecommendedSeats: 2,
      },
      {
        id: "chatgpt-enterprise",
        name: "Enterprise",
        pricePerSeat: 60, // estimated starting; custom
        features: [
          "Unlimited GPT-5.5",
          "Advanced security",
          "SSO/SCIM",
          "Custom data retention",
        ],
        minRecommendedSeats: 50,
      },
    ],
  },
  {
    id: "gemini",
    name: "Google Gemini",
    category: "assistant",
    icon: "✨",
    website: "https://one.google.com/about/google-ai-plans/",
    plans: [
      {
        id: "gemini-free",
        name: "Free",
        pricePerSeat: 0,
        features: [
          "Gemini 2.5 Flash",
          "Limited 2.5 Pro",
          "100 AI credits",
        ],
      },
      {
        id: "gemini-pro",
        name: "AI Pro",
        pricePerSeat: 20, // $19.99 rounded
        features: [
          "Gemini 3.1 Pro",
          "1,000 AI credits",
          "Deep Research",
          "5TB storage",
          "Gemini in Workspace",
        ],
      },
      {
        id: "gemini-ultra",
        name: "AI Ultra",
        pricePerSeat: 250, // $249.99 rounded
        features: [
          "Gemini 3.1 Pro Deep Think",
          "25,000 AI credits",
          "Veo 3.1 video",
          "30TB storage",
          "YouTube Premium",
        ],
      },
    ],
  },

  // ─── API Direct ───
  {
    id: "anthropic-api",
    name: "Anthropic API",
    category: "api",
    icon: "🔌",
    website: "https://www.anthropic.com/pricing",
    plans: [
      {
        id: "anthropic-api-direct",
        name: "API Direct (Pay-as-you-go)",
        pricePerSeat: 0, // usage-based; user enters actual spend
        features: [
          "Opus 4.6: $5/$25 per MTok",
          "Sonnet 4.6: $3/$15 per MTok",
          "Haiku 4.5: $1/$5 per MTok",
          "Prompt caching, Batch API",
        ],
      },
    ],
  },
  {
    id: "openai-api",
    name: "OpenAI API",
    category: "api",
    icon: "⚡",
    website: "https://openai.com/api/pricing/",
    plans: [
      {
        id: "openai-api-direct",
        name: "API Direct (Pay-as-you-go)",
        pricePerSeat: 0,
        features: [
          "GPT-5.5: $5/$30 per MTok",
          "GPT-5 mini: $0.25/$2 per MTok",
          "GPT-4.1: $2/$8 per MTok",
          "Batch API discount",
        ],
      },
    ],
  },
];

/**
 * Get a tool by its ID.
 */
export function getToolById(id: string): AITool | undefined {
  return AI_TOOLS.find((t) => t.id === id);
}

/**
 * Get a specific plan within a tool.
 */
export function getPlan(
  toolId: string,
  planId: string
): { tool: AITool; plan: import("@/types").ToolPlan } | undefined {
  const tool = getToolById(toolId);
  if (!tool) return undefined;
  const plan = tool.plans.find((p) => p.id === planId);
  if (!plan) return undefined;
  return { tool, plan };
}

/**
 * Credex discount rate — the percentage savings obtainable
 * through Credex-sourced discounted credits.
 * Conservative estimate based on the assignment brief.
 */
export const CREDEX_DISCOUNT_RATE = 0.15; // 15% additional savings on eligible tools

/**
 * Returns a flat map of { planId → pricePerSeat } for the current pricing data.
 * Stored as the pricing_snapshot on each saved audit so we can detect future changes.
 */
export function getPricingSnapshot(): Record<string, number> {
  const snapshot: Record<string, number> = {};
  for (const tool of AI_TOOLS) {
    for (const plan of tool.plans) {
      snapshot[plan.id] = plan.pricePerSeat;
    }
  }
  return snapshot;
}

/**
 * Returns a copy of AI_TOOLS with price overrides applied.
 * Overrides: { planId → newPrice }
 */
export function applyPricingOverrides(
  overrides: Record<string, number>
): typeof AI_TOOLS {
  if (Object.keys(overrides).length === 0) return AI_TOOLS;
  return AI_TOOLS.map((tool) => ({
    ...tool,
    plans: tool.plans.map((plan) => ({
      ...plan,
      pricePerSeat:
        plan.id in overrides ? overrides[plan.id] : plan.pricePerSeat,
    })),
  }));
}

/**
 * Compares a stored pricing snapshot against a current snapshot and
 * returns an array of changes (planId, oldPrice, newPrice).
 */
export function diffPricingSnapshots(
  stored: Record<string, number>,
  current: Record<string, number>
): Array<{ planId: string; oldPrice: number; newPrice: number }> {
  const changes: Array<{ planId: string; oldPrice: number; newPrice: number }> =
    [];
  for (const planId of Object.keys(stored)) {
    const oldPrice = stored[planId];
    const newPrice = current[planId];
    if (newPrice !== undefined && newPrice !== oldPrice) {
      changes.push({ planId, oldPrice, newPrice });
    }
  }
  return changes;
}
