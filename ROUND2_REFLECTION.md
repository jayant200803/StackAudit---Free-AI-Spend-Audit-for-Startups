# Round 2 Reflection

---

## 1. What was the most uncomfortable trade-off you made because of the time pressure?

Skipping automated tests for the three new API routes (`/api/admin/update-pricing`, `/api/detect-changes`, `/api/audit` changes).

The uncomfortable part: I can't actually verify the detect-changes consolidation logic with a unit test — I verified it manually with one user and one audit. If there's a bug in the grouping logic (e.g., a user with three audits gets three emails instead of one), I wouldn't know until it happened in production. That's a real risk I accepted.

What I protected: the audit engine tests (all 10 pass), because `runAudit()` is the core business logic and the change to accept `customTools` was a non-trivial signature change. I wasn't willing to ship that without test coverage.

What I cut: integration tests for the new endpoints. The right approach would be to mock Supabase and Resend and test the detect-changes flow end-to-end. That's probably 2-3 hours of work — more than the endpoint itself took to write.

---

## 2. If the deadline extended by 24 hours, what's the first thing you'd do?

Write the integration test for `detect-changes`.

Specifically: mock `supabaseAdmin.from("audits").select()` to return two audits with the same email and different affected plans, mock the Resend `fetch` call, and assert that exactly one email was sent (not two) with both changes listed.

That's the part of the code I trust least right now. The consolidation logic is correct in theory and verified manually, but "verified manually with one test case" is not the same as "correct". If that test fails, it would immediately tell me the bug — and I'd fix it before the PR merged.

Second thing after that: add the unsubscribe link. It's a one-click token stored in the database, generated at email capture time. The absence of it is the thing most likely to bother a real user if this shipped.

---

## 3. What's one thing your Round 1 self made harder for your Round 2 self?

Not storing `user_email` on the `audits` table from the start.

In Round 1, the `leads` table has `(email, audit_id)` and the `audits` table has no email. That design is fine for Round 1's use case — share URLs are public and don't need the email. But for Round 2, "give me all audits associated with a real user" requires either a JOIN or a schema change.

I chose the schema change (`ALTER TABLE audits ADD COLUMN user_email`) and backfilled it in the lead capture route. That worked, but it required a migration, a service role client with UPDATE privileges, and a new RLS policy. If I had stored `user_email` on `audits` from day one (even as nullable), Round 2's detect-changes query would have been one line instead of a multi-step backfill.

The lesson: when building a tool that captures emails, assume from the start that you'll want to associate future data with those emails. Make the email a first-class field on every table it touches, not a foreign key to a separate `leads` table.
