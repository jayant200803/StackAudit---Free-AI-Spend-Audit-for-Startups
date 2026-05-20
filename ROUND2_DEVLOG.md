# Round 2 Devlog — Re-audit on Pricing Change

36-hour window: 2026-05-20 10:00 AM → 2026-05-21 10:00 PM

---

## 2026-05-20 10:00 — Start

Received assignment. Read the entire document twice before writing a line of code. Key requirements:
1. Persistent audit storage (with email + pricing snapshot)
2. Pricing-change detection (scheduled or manual trigger)
3. Notification emails (consolidated per user)
4. Diff view on re-run

Going to plan for 30 min before touching code. Round 1 codebase is mine so I know it well — but I haven't thought about it since submission, so worth re-reading.

## 2026-05-20 10:35 — Architecture decision made

Core decisions:
- **Pricing overrides via Supabase table** (`pricing_overrides`) rather than env vars or redeployment. Lets the reviewer test pricing changes via API call without touching the repo.
- **`POST /api/detect-changes`** as the trigger — manual (acceptable per spec) but also registered as a Vercel Cron (bonus).
- **`/reaudit/[id]`** as the diff view. Server component fetches the original audit, re-runs the engine with current pricing, passes both to a client component for the visual diff.
- **Backfill `user_email` on `audits` table** when lead is captured — instead of always joining with `leads`, which complicates the query.

Risk identified: Vercel Cron requires a Pro plan. Mitigated by making the endpoint manually triggerable. Cron is bonus behavior.

## 2026-05-20 11:00 — Branch created, Supabase migration written

Created `round-2-reaudit` branch. Wrote the SQL migration (two `ALTER TABLE` statements + new `pricing_overrides` table). Put it in `supabase.ts` as a comment for the reviewer.

Decided to use `supabaseAdmin` (service role client) for the detect-changes endpoint — needed to read `user_email` from `audits` table and the existing RLS would block that. The service role key is server-side only.

## 2026-05-20 11:40 — Pricing utilities built

Added to `pricing-data.ts`:
- `getPricingSnapshot()` — returns `{ planId → pricePerSeat }` for all plans
- `applyPricingOverrides()` — returns AI_TOOLS with prices mutated
- `diffPricingSnapshots()` — compares two snapshots, returns changed plans

Created `src/lib/current-pricing.ts` — server-side utility that loads overrides from Supabase and applies them. Falls back to static data if the table doesn't exist yet (graceful degradation for old deployments).

## 2026-05-20 12:15 — Audit engine modified

`runAudit()` now accepts an optional `customTools?: AITool[]` parameter. Defaults to the static `AI_TOOLS` import. This is the change that enables the diff view to re-run with overridden pricing without any global state mutation.

Had to thread the `tools` parameter through `evaluateTool()`, `findCheaperAlternative()`, and `makeKeepRec()`. Slightly verbose but correct — no shared state.

All 10 existing tests still pass after this change.

## 2026-05-20 13:00 — Lunch break

30 min.

## 2026-05-20 13:30 — API routes built

Built three new API routes:

**`/api/audit` (modified):** Now saves `pricing_snapshot: getPricingSnapshot()` on every insert. Also exposes `input` in the GET response (needed by the diff page).

**`/api/lead` (modified):** After saving the lead, uses `supabaseAdmin` to UPDATE `audits.user_email`. This is the link between "user has an email" and "detect-changes can find their audit".

**`/api/admin/update-pricing`:** POST to set a price override, DELETE to remove it. Protected by `x-admin-secret` header. Uses `upsert` so calling it twice with the same planId just updates.

## 2026-05-20 14:30 — detect-changes endpoint built

This is the core of Round 2. The logic:
1. Load current tools (static + overrides)
2. Fetch all audits with `user_email NOT NULL` and `pricing_snapshot NOT NULL`
3. For each audit: `diffPricingSnapshots(stored, current)`
4. Filter to only plans that appear in that audit's input
5. Re-run `runAudit(input, currentTools)` for affected audits
6. Group by email → build one HTML email per user
7. Send via Resend, return summary

The consolidation logic was the trickiest part — tracking which emails have been grouped and making sure one user with three affected audits gets one email, not three.

## 2026-05-20 15:30 — Hit a blocker with Resend

Remembered the same issue from Round 1: Resend free tier only delivers to the account owner's email. The reviewer's email won't receive the notification unless the domain is verified or the reviewer uses the account email.

Decision: keep `onboarding@resend.dev` as the sender (same as Round 1), document the limitation in ROUND2_PR.md and in the manual testing instructions. The email IS sent and appears in the Resend dashboard — just not delivered to arbitrary inboxes on free tier.

## 2026-05-20 16:30 — Diff view page built

`/reaudit/[id]` is a Next.js server component (no "use client" at the page level). It:
1. Fetches the original audit from Supabase using `supabaseAdmin`
2. Loads current pricing (with overrides)
3. Re-runs the engine
4. Computes pricing changes using `diffPricingSnapshots()`
5. Passes everything to `ReauditClient` for rendering

`ReauditClient` handles the visual diff: a 3-column savings header (original / updated / delta), a pricing changes section, and per-tool cards with CHANGED / SAME badges. Changed tools show old and new recommendations side-by-side.

## 2026-05-20 17:30 — Vercel cron added

Added `vercel.json` with `"schedule": "0 9 * * *"` (09:00 UTC daily). The endpoint needs `ADMIN_SECRET` in the header — Vercel Cron can't send custom headers. Adjusted the detect-changes endpoint to not require the secret when called without an `Authorization` header in a Cron context. Actually — no. Kept the secret requirement and documented that the cron trigger is an unauthenticated call that Vercel handles internally. The `ADMIN_SECRET` check only applies to non-Cron callers. For simplicity, if `ADMIN_SECRET` is not set, the endpoint is open.

## 2026-05-20 18:00 — End-to-end manual test

Full flow:
1. Run audit with Cursor Pro, 5 seats → email captured ✓
2. Audit row has `pricing_snapshot: {"cursor-pro": 20, ...}` and `user_email` set ✓
3. POST /api/admin/update-pricing with `{ planId: "cursor-pro", newPrice: 25 }` ✓
4. POST /api/detect-changes → `{ checked: 1, affected: 1, emailsSent: 1 }` ✓
5. Resend dashboard shows email sent ✓
6. Navigate to `/reaudit/[id]` → shows "cursor-pro: $20 → $25", CHANGED badge on Cursor row ✓

## 2026-05-20 19:00 — Markdown files + cleanup

Writing ROUND2_PR.md, ROUND2_DEVLOG.md, ROUND2_REFLECTION.md.
Reviewing code diff — removed dead code, added comments on non-obvious decisions.

## 2026-05-20 20:00 — Final review and commit

Final build passes. All Round 1 tests still pass. Code review pass:
- No secrets in code ✓
- Backward compatible (old audits without pricing_snapshot are skipped, not errored) ✓
- Round 1 share page still works ✓
- No dead imports ✓

Committing and pushing PR.

## 2026-05-20 20:30 — PR pushed

Branch `round-2-reaudit` pushed to GitHub. PR opened against `main`. Deadline: 2026-05-21 22:00. Submitted with ~26 hours to spare.
