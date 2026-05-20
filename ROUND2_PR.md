# feat: add re-audit on pricing change with email notifications

## What this PR does

Adds a system that detects when AI tool pricing changes since a user's audit was run, emails affected users with a consolidated notification, and shows a side-by-side diff of old vs new recommendations at `/reaudit/[id]`. Audits now persist a pricing snapshot at save time; a detection endpoint compares snapshots against current pricing (including any admin-applied overrides) to find who needs notifying.

## Why

AI tool pricing changes regularly — Cursor, Copilot, and Claude have all changed plans in the past 12 months. A one-time audit becomes misleading the moment prices shift. Users who submitted their email trusted the tool to keep their audit accurate; stale recommendations could cause them to make wrong decisions. This feature makes the trust implicit in email capture explicit: we will tell you when things change.

## How it works

```
Admin updates pricing
  → POST /api/admin/update-pricing  (writes to pricing_overrides table)

Detection runs (scheduled daily at 09:00 UTC, or manual POST)
  → POST /api/detect-changes
      1. Load current pricing = static defaults + overrides from Supabase
      2. Fetch all audits WHERE user_email IS NOT NULL AND pricing_snapshot IS NOT NULL
      3. For each audit: diff stored snapshot vs current snapshot
      4. Filter to plans actually used in that audit
      5. Re-run runAudit(input, currentTools) to get new recommendations
      6. Group affected audits by email → one email per user (no spam)
      7. Return { checked, affected, emailsSent, changes }

User clicks link in email
  → GET /reaudit/[id]  (server component)
      1. Fetch original audit from Supabase
      2. Load current pricing (same as step 1 above)
      3. Re-run engine with current pricing
      4. Pass old + new recommendations to ReauditClient
      5. Show side-by-side diff with CHANGED / SAME badges
```

**New files:**
- `src/lib/current-pricing.ts` — server-side: loads overrides from Supabase, applies to AI_TOOLS
- `src/lib/pricing-data.ts` — added `getPricingSnapshot()`, `applyPricingOverrides()`, `diffPricingSnapshots()`
- `src/app/api/admin/update-pricing/route.ts` — admin endpoint to set a price override
- `src/app/api/detect-changes/route.ts` — detection + consolidated email sending
- `src/app/reaudit/[id]/page.tsx` — server component: fetches audit, runs re-audit
- `src/app/reaudit/[id]/ReauditClient.tsx` — client component: diff view UI
- `vercel.json` — Vercel Cron scheduled daily at 09:00 UTC

**Modified files:**
- `src/lib/audit-engine.ts` — `runAudit()` accepts optional `customTools` parameter
- `src/lib/supabase.ts` — added `supabaseAdmin` (service role client)
- `src/app/api/audit/route.ts` — now saves `pricing_snapshot` on insert; exposes `input` in GET response
- `src/app/api/lead/route.ts` — backfills `user_email` on the audit row after lead is captured

## What I cut

- **Unsubscribe link in emails** — the spec lists it as bonus. With 36 hours, the diff view was higher value. The email does include a plain-text note about why they received it. A one-click unsubscribe token (store in `leads.unsubscribe_token`, validate on GET /api/unsubscribe) is the obvious next addition.
- **Public pricing changelog page** — bonus feature. The `/api/detect-changes` response body already returns a `changes` array that could power a public page; the page itself was cut.
- **Admin dashboard** — bonus. The raw numbers (`checked`, `affected`, `emailsSent`) are returned in the API response and visible in Vercel logs. A UI wrapper was cut.
- **Automated tests for new endpoints** — the core audit engine tests still pass. The new endpoints have more external dependencies (Supabase, Resend) that make unit testing heavier; integration tests would be the right approach and were the first thing I'd add with more time.
- **Redis rate limiting on detect-changes** — the endpoint is admin-only (secret header) so abuse risk is low. In-memory rate limiting is not needed here.

## How to test manually

**Setup (one-time):**
1. Run the Round 2 SQL migration in Supabase SQL Editor (see `src/lib/supabase.ts` for the exact SQL)
2. Add `SUPABASE_SERVICE_ROLE_KEY` and `ADMIN_SECRET` to `.env.local` and Vercel environment variables

**End-to-end flow:**
1. Go to `https://aispend-audit.vercel.app` and submit an audit with Cursor Pro ($20/seat, 5 seats)
2. When prompted, enter your email to capture the lead
3. Verify: audit row in Supabase now has `user_email` and `pricing_snapshot` columns populated
4. Simulate a price change:
   ```
   POST /api/admin/update-pricing
   Header: x-admin-secret: <your ADMIN_SECRET>
   Body: { "planId": "cursor-pro", "toolId": "cursor", "newPrice": 25 }
   ```
5. Trigger detection:
   ```
   POST /api/detect-changes
   Header: x-admin-secret: <your ADMIN_SECRET>
   ```
6. Check your inbox — you should receive one email listing the Cursor price change and a "View Diff" link
7. Click the link → lands on `/reaudit/[id]` showing old ($20) vs new ($25) with CHANGED badge on the Cursor row
8. To reset: `DELETE /api/admin/update-pricing` with `{ "planId": "cursor-pro" }`

## What I tested

- All 10 Round 1 Vitest unit tests still pass (audit engine is backward compatible)
- Manual end-to-end: audit → email submit → pricing override → detect-changes → email received → diff page renders
- `runAudit()` with `customTools` parameter verified against known inputs
- `diffPricingSnapshots()` verified: returns empty array for identical snapshots, correct deltas for changed prices
- Edge case: `detect-changes` with no audits in DB returns `{ checked: 0, affected: 0, emailsSent: 0 }` cleanly
- Edge case: audit with no `pricing_snapshot` (older Round 1 audits) is skipped without error

**Skipped due to time:**
- Integration tests for `/api/detect-changes` (would need Supabase + Resend mocks)
- Test for consolidated email (one email per user with multiple affected audits)
- Visual regression on the diff page

## Open questions / risks

- **Pricing overrides are not scoped by time** — if an override is set, _all_ detect-changes runs from that point forward will treat it as the current price. There's no history of "when did the price change". In production this needs a `pricing_changes` history table to answer "what price was it on date X".
- **Re-run uses current override pricing** — the diff view re-runs the engine with whatever the current override says. If an override is removed between email send and user clicking the link, the diff page will show no change. This is a race condition that's acceptable at MVP scale but would need a point-in-time snapshot to fix properly.
- **Resend free tier limitation** — on the free plan, Resend only delivers to the account owner's email. If the reviewer uses a different email, the email goes to the Resend dashboard but not the inbox. The fix is domain verification — documented in the devlog.
