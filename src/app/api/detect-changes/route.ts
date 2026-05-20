import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getCurrentTools, getCurrentPricingSnapshot } from "@/lib/current-pricing";
import { diffPricingSnapshots, AI_TOOLS } from "@/lib/pricing-data";
import { runAudit } from "@/lib/audit-engine";
import type { AuditInput, ToolRecommendation } from "@/types";

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://aispend-audit.vercel.app";

interface StoredAudit {
  id: string;
  user_email: string;
  input: AuditInput;
  recommendations: ToolRecommendation[];
  total_monthly_savings: number;
  pricing_snapshot: Record<string, number> | null;
  created_at: string;
}

interface PriceChange {
  planId: string;
  toolId: string;
  toolName: string;
  planName: string;
  oldPrice: number;
  newPrice: number;
  delta: number;
}

/**
 * POST /api/detect-changes
 *
 * Scans all stored audits with a user_email and pricing_snapshot.
 * For each audit, compares the stored snapshot to current pricing.
 * Groups affected audits by email and sends one consolidated notification
 * per user — never multiple emails for the same user.
 *
 * Skips users who have unsubscribed (leads.unsubscribed = true).
 * Saves all detected price changes to the pricing_changes log table.
 * Includes a one-click unsubscribe link in every notification email.
 *
 * Also protected by ADMIN_SECRET (same header as update-pricing).
 *
 * This endpoint is called:
 * 1. Manually by the reviewer: POST /api/detect-changes
 * 2. On a schedule via Vercel Cron (see vercel.json)
 *
 * Response: { checked, affected, emailsSent, changes }
 */
export async function POST(req: NextRequest) {
  // Auth check — same secret as admin endpoint
  const adminSecret = process.env.ADMIN_SECRET;
  const providedSecret = req.headers.get("x-admin-secret");

  if (adminSecret && providedSecret !== adminSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 1. Load current pricing (static defaults + any overrides from DB)
  const currentTools = await getCurrentTools();
  const currentSnapshot = await getCurrentPricingSnapshot();

  // 2. Load all audits with a user_email and pricing_snapshot
  const { data: audits, error } = await supabaseAdmin
    .from("audits")
    .select("id, user_email, input, recommendations, total_monthly_savings, pricing_snapshot, created_at")
    .not("user_email", "is", null)
    .not("pricing_snapshot", "is", null);

  if (error) {
    console.error("Failed to load audits:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!audits || audits.length === 0) {
    return NextResponse.json({
      checked: 0,
      affected: 0,
      emailsSent: 0,
      changes: [],
      message: "No audits with user emails found. Run an audit and submit your email first.",
    });
  }

  // 3. Load unsubscribe info for all emails that appear in audits
  const allEmails = Array.from(new Set((audits as StoredAudit[]).map((a) => a.user_email)));
  const { data: leadsData } = await supabaseAdmin
    .from("leads")
    .select("email, unsubscribe_token, unsubscribed")
    .in("email", allEmails);

  // Build a quick lookup: email → { token, unsubscribed }
  const leadsByEmail = new Map<string, { token: string | null; unsubscribed: boolean }>();
  for (const lead of leadsData ?? []) {
    // If the same email appears in multiple lead rows, prefer unsubscribed=true
    const existing = leadsByEmail.get(lead.email);
    if (!existing || lead.unsubscribed) {
      leadsByEmail.set(lead.email, {
        token: lead.unsubscribe_token ?? null,
        unsubscribed: lead.unsubscribed ?? false,
      });
    }
  }

  // 4. Detect affected audits
  type AffectedEntry = {
    audit: StoredAudit;
    priceChanges: PriceChange[];
    newRecommendations: ToolRecommendation[];
    newTotalSavings: number;
  };

  const affectedByEmail = new Map<string, AffectedEntry[]>();

  for (const audit of audits as StoredAudit[]) {
    const snapshot = audit.pricing_snapshot;
    if (!snapshot) continue;

    // Compare stored snapshot vs current prices
    const rawChanges = diffPricingSnapshots(snapshot, currentSnapshot);
    if (rawChanges.length === 0) continue;

    // Only flag if any changed plan is actually used in this audit
    const usedPlanIds = new Set(audit.input.tools.map((t) => t.planId));
    const relevantChanges = rawChanges.filter((c) => usedPlanIds.has(c.planId));
    if (relevantChanges.length === 0) continue;

    // Map planId → tool name / plan name for email readability
    const priceChanges: PriceChange[] = relevantChanges.map((c) => {
      const tool =
        currentTools.find((t) => t.plans.some((p) => p.id === c.planId)) ??
        AI_TOOLS.find((t) => t.plans.some((p) => p.id === c.planId));
      const plan = tool?.plans.find((p) => p.id === c.planId);
      return {
        planId: c.planId,
        toolId: tool?.id ?? c.planId,
        toolName: tool?.name ?? c.planId,
        planName: plan?.name ?? c.planId,
        oldPrice: c.oldPrice,
        newPrice: c.newPrice,
        delta: c.newPrice - c.oldPrice,
      };
    });

    // Re-run the audit with current pricing to get updated recommendations
    const newResult = runAudit(audit.input, currentTools);
    const newTotalSavings = newResult.totalMonthlySavings;

    const email = audit.user_email;
    if (!affectedByEmail.has(email)) {
      affectedByEmail.set(email, []);
    }
    affectedByEmail.get(email)!.push({
      audit,
      priceChanges,
      newRecommendations: newResult.recommendations,
      newTotalSavings,
    });
  }

  // 5. Persist all unique price changes to the pricing_changes log
  const allUniqueChanges = new Map<string, PriceChange>();
  for (const entries of Array.from(affectedByEmail.values())) {
    for (const entry of entries) {
      for (const c of entry.priceChanges) {
        allUniqueChanges.set(c.planId, c);
      }
    }
  }

  if (allUniqueChanges.size > 0) {
    const changeRows = Array.from(allUniqueChanges.values()).map((c) => ({
      plan_id: c.planId,
      tool_id: c.toolId,
      tool_name: c.toolName,
      plan_name: c.planName,
      old_price: c.oldPrice,
      new_price: c.newPrice,
    }));
    // Best-effort: if pricing_changes table doesn't exist yet, swallow the error
    await supabaseAdmin.from("pricing_changes").insert(changeRows);
  }

  // 6. Send one consolidated email per affected user (skip unsubscribed)
  let emailsSent = 0;
  const allChangeSummaries: string[] = [];

  for (const [email, entries] of Array.from(affectedByEmail.entries())) {
    const leadInfo = leadsByEmail.get(email);

    // Skip users who have opted out
    if (leadInfo?.unsubscribed) continue;

    const unsubscribeUrl = leadInfo?.token
      ? `${APP_URL}/api/unsubscribe?token=${leadInfo.token}`
      : null;

    const sent = await sendReauditEmail(email, entries, APP_URL, unsubscribeUrl);
    if (sent) emailsSent++;

    for (const entry of entries) {
      for (const c of entry.priceChanges) {
        const summary = `${c.toolName} (${c.planId}): $${c.oldPrice} → $${c.newPrice}`;
        if (!allChangeSummaries.includes(summary)) {
          allChangeSummaries.push(summary);
        }
      }
    }
  }

  return NextResponse.json({
    checked: audits.length,
    affected: affectedByEmail.size,
    emailsSent,
    changes: allChangeSummaries,
  });
}

// ── Email builder ──

async function sendReauditEmail(
  email: string,
  entries: Array<{
    audit: StoredAudit;
    priceChanges: PriceChange[];
    newRecommendations: ToolRecommendation[];
    newTotalSavings: number;
  }>,
  appUrl: string,
  unsubscribeUrl: string | null
): Promise<boolean> {
  if (!RESEND_API_KEY) return false;

  // Collect all unique price changes across all this user's audits
  const allChanges = new Map<string, PriceChange>();
  for (const entry of entries) {
    for (const c of entry.priceChanges) {
      allChanges.set(c.planId, c);
    }
  }

  const changesHtml = Array.from(allChanges.values())
    .map((c) => {
      const dir = c.delta > 0 ? "📈" : "📉";
      const sign = c.delta > 0 ? "+" : "";
      return `<li style="margin-bottom:8px;">
        ${dir} <strong>${c.toolName}</strong>:
        $${c.oldPrice}/seat → $${c.newPrice}/seat
        (<span style="color:${c.delta > 0 ? "#dc2626" : "#16a34a"}">${sign}$${Math.abs(c.delta)}/seat/mo</span>)
      </li>`;
    })
    .join("");

  // Build per-audit impact section
  const auditsHtml = entries
    .map((entry) => {
      const oldSavings = entry.audit.total_monthly_savings;
      const newSavings = entry.newTotalSavings;
      const delta = newSavings - oldSavings;
      const rerunUrl = `${appUrl}/reaudit/${entry.audit.id}`;
      const auditDate = new Date(entry.audit.created_at).toLocaleDateString(
        "en-US",
        { month: "short", day: "numeric", year: "numeric" }
      );
      return `
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px;margin-bottom:12px;">
          <p style="margin:0 0 8px;font-size:13px;color:#64748b;">Audit from ${auditDate}</p>
          <p style="margin:0 0 4px;font-size:14px;">
            Previous savings found: <strong>$${oldSavings.toLocaleString()}/mo</strong>
          </p>
          <p style="margin:0 0 12px;font-size:14px;">
            Updated savings estimate: <strong style="color:${delta >= 0 ? "#16a34a" : "#dc2626"}">$${newSavings.toLocaleString()}/mo</strong>
            ${delta !== 0 ? `<span style="color:#64748b;font-size:12px;">(${delta > 0 ? "+" : ""}$${delta}/mo vs your original audit)</span>` : ""}
          </p>
          <a href="${rerunUrl}"
             style="display:inline-block;background:#0f172a;color:white;padding:10px 20px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:600;">
            View Diff — Old vs New →
          </a>
        </div>`;
    })
    .join("");

  const unsubscribeHtml = unsubscribeUrl
    ? `<br/><a href="${unsubscribeUrl}" style="color:#94a3b8;">Unsubscribe from pricing alerts</a>`
    : "";

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "StackAudit <onboarding@resend.dev>",
        to: [email],
        subject: `⚠️ AI tool pricing changed — your audit may be outdated`,
        html: `
          <div style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto;padding:32px 24px;color:#1e293b;">
            <h1 style="font-size:22px;font-weight:700;margin-bottom:8px;">Pricing changed since your audit</h1>
            <p style="color:#64748b;font-size:15px;margin-bottom:24px;">
              We detected price changes for AI tools in your stack. Your previous audit recommendations may no longer be accurate.
            </p>

            <h2 style="font-size:15px;font-weight:700;margin-bottom:12px;color:#374151;">What changed:</h2>
            <ul style="padding-left:20px;margin-bottom:24px;color:#374151;">
              ${changesHtml}
            </ul>

            <h2 style="font-size:15px;font-weight:700;margin-bottom:12px;color:#374151;">How it affects your audit${entries.length > 1 ? "s" : ""}:</h2>
            ${auditsHtml}

            <hr style="border:none;border-top:1px solid #e2e8f0;margin:28px 0;" />
            <p style="color:#94a3b8;font-size:12px;margin:0;">
              StackAudit by <a href="https://credex.rocks" style="color:#94a3b8;">Credex</a> — discounted AI infrastructure credits for startups.<br/>
              You received this because you submitted your email for an AI spend audit.
              ${unsubscribeHtml}
            </p>
          </div>
        `,
      }),
    });

    return res.ok;
  } catch (err) {
    console.error("Reaudit email failed for", email, err);
    return false;
  }
}
