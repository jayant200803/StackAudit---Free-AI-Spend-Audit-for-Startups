import { NextRequest, NextResponse } from "next/server";
import { supabase, supabaseAdmin } from "@/lib/supabase";
import { z } from "zod";

const LeadSchema = z.object({
  email: z.string().email("Invalid email address"),
  companyName: z.string().max(200).optional(),
  role: z.string().max(100).optional(),
  auditId: z.string().uuid("Invalid audit ID"),
  totalMonthlySavings: z.number().min(0),
});

// Simple in-memory rate limiting (per-instance; use Redis in production)
const rateLimitMap = new Map<string, { count: number; windowStart: number }>();
const RATE_LIMIT = 5; // max leads per IP per hour
const RATE_WINDOW = 60 * 60 * 1000; // 1 hour in ms

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now - entry.windowStart > RATE_WINDOW) {
    rateLimitMap.set(ip, { count: 1, windowStart: now });
    return false;
  }

  if (entry.count >= RATE_LIMIT) {
    return true;
  }

  entry.count += 1;
  return false;
}

/**
 * POST /api/lead
 * Captures a lead: validates, rate-limits, stores in Supabase, sends transactional email.
 */
export async function POST(req: NextRequest) {
  try {
    // Rate limiting
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      "unknown";

    if (isRateLimited(ip)) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429 }
      );
    }

    // Validate input
    const body = await req.json();
    const parsed = LeadSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message || "Invalid input" },
        { status: 400 }
      );
    }

    const lead = parsed.data;

    // Store in Supabase (if configured)
    if (
      process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    ) {
      const { error } = await supabase.from("leads").insert({
        email: lead.email,
        company_name: lead.companyName || null,
        role: lead.role || null,
        audit_id: lead.auditId,
        total_monthly_savings: lead.totalMonthlySavings,
      });

      if (error) {
        console.error("Supabase lead insert error:", error);
        // Don't block the user — log and continue
      }

      // Round 2: backfill user_email on the audit row so detect-changes can
      // find all audits that belong to a real user.
      await supabaseAdmin
        .from("audits")
        .update({ user_email: lead.email })
        .eq("id", lead.auditId);
    }

    // Send transactional email via Resend (if configured)
    const resendKey = process.env.RESEND_API_KEY;
    if (resendKey) {
      try {
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://stackaudit.credex.rocks";
        const shareUrl = `${appUrl}/share/${lead.auditId}`;
        const savingsText =
          lead.totalMonthlySavings > 0
            ? `We found $${lead.totalMonthlySavings}/mo in potential savings.`
            : "Your AI stack is well-optimized.";

        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${resendKey}`,
          },
          body: JSON.stringify({
            from: "StackAudit <onboarding@resend.dev>",
            to: [lead.email],
            subject: `Your AI Spend Audit — ${
              lead.totalMonthlySavings > 0
                ? `$${lead.totalMonthlySavings}/mo in savings found`
                : "Stack is optimized"
            }`,
            html: `
              <div style="font-family: 'DM Sans', system-ui, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px 24px;">
                <h1 style="font-size: 24px; font-weight: 600; color: #1c1917; margin-bottom: 16px;">
                  Your StackAudit Report
                </h1>
                <p style="color: #78716c; font-size: 16px; line-height: 1.6; margin-bottom: 24px;">
                  ${savingsText} View your full audit breakdown:
                </p>
                <a href="${shareUrl}"
                   style="display: inline-block; background: #16a34a; color: white; padding: 12px 24px;
                          border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">
                  View My Audit →
                </a>
                ${
                  lead.totalMonthlySavings >= 500
                    ? `<p style="margin-top: 24px; padding: 16px; background: #f0fdf4; border-radius: 8px; color: #166534; font-size: 14px;">
                        💰 <strong>High-savings alert:</strong> A Credex advisor will reach out within 24 hours to discuss how to maximize your savings.
                      </p>`
                    : ""
                }
                <hr style="border: none; border-top: 1px solid #e7e5e4; margin: 32px 0;" />
                <p style="color: #a8a29e; font-size: 12px;">
                  StackAudit by <a href="https://credex.rocks" style="color: #a8a29e;">Credex</a> — discounted AI infrastructure credits for startups.
                </p>
              </div>
            `,
          }),
        });
      } catch (emailError) {
        console.error("Email send failed:", emailError);
        // Non-blocking — lead is already saved
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Lead capture failed:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
