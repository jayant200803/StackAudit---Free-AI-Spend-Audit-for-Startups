import { supabaseAdmin } from "@/lib/supabase";

interface PricingChange {
  id: string;
  plan_id: string;
  tool_id: string;
  tool_name: string;
  plan_name: string;
  old_price: number;
  new_price: number;
  detected_at: string;
}

/**
 * /changelog — Public pricing history page.
 *
 * Shows every AI tool price change that StackAudit has detected.
 * Data is written to the `pricing_changes` table by /api/detect-changes
 * each time it runs and finds differences.
 *
 * Publicly readable (RLS policy: Allow anon read pricing_changes).
 */
export const revalidate = 300; // ISR: re-fetch every 5 min

async function getChanges(): Promise<PricingChange[]> {
  try {
    const { data } = await supabaseAdmin
      .from("pricing_changes")
      .select("*")
      .order("detected_at", { ascending: false })
      .limit(200);
    return data ?? [];
  } catch {
    return [];
  }
}

export default async function ChangelogPage() {
  const changes = await getChanges();

  // Group by date (YYYY-MM-DD) for timeline rendering
  const grouped = new Map<string, PricingChange[]>();
  for (const c of changes) {
    const day = c.detected_at.slice(0, 10);
    if (!grouped.has(day)) grouped.set(day, []);
    grouped.get(day)!.push(c);
  }

  return (
    <div className="min-h-screen bg-dark text-white">
      {/* ── Header ── */}
      <div className="border-b border-white/10 bg-dark2">
        <div className="max-w-3xl mx-auto px-4 py-5 flex items-center justify-between">
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

      <div className="max-w-3xl mx-auto px-4 py-10">
        {/* ── Title ── */}
        <div className="mb-10">
          <div className="inline-block bg-blue-500/10 border border-blue-500/30 text-blue-400 text-xs font-semibold px-3 py-1 rounded-full mb-4">
            PRICING CHANGELOG
          </div>
          <h1 className="text-3xl font-bold mb-2">AI Tool Pricing History</h1>
          <p className="text-gray-400 text-sm">
            Every price change StackAudit has detected across the tools in its
            database. Updated automatically when pricing changes are found.
          </p>
        </div>

        {/* ── Content ── */}
        {changes.length === 0 ? (
          <div className="bg-dark2 border border-white/10 rounded-xl p-8 text-center">
            <p className="text-gray-400 text-sm">
              No pricing changes recorded yet.
            </p>
            <p className="text-gray-500 text-xs mt-2">
              Changes are logged whenever{" "}
              <code className="text-gray-400">/api/detect-changes</code> runs
              and finds differences between stored and current pricing.
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            {Array.from(grouped.entries()).map(([day, dayChanges]) => {
              const date = new Date(day + "T00:00:00Z").toLocaleDateString(
                "en-US",
                { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" }
              );
              return (
                <div key={day}>
                  {/* Date header */}
                  <div className="flex items-center gap-3 mb-4">
                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      {date}
                    </span>
                    <div className="flex-1 h-px bg-white/10" />
                    <span className="text-xs text-gray-600">
                      {dayChanges.length} change{dayChanges.length !== 1 ? "s" : ""}
                    </span>
                  </div>

                  {/* Change rows */}
                  <div className="space-y-3">
                    {dayChanges.map((c) => {
                      const up = c.new_price > c.old_price;
                      const delta = c.new_price - c.old_price;
                      return (
                        <div
                          key={c.id}
                          className="bg-dark2 border border-white/10 rounded-xl px-5 py-4 flex items-center justify-between"
                        >
                          <div>
                            <span className="font-semibold">{c.tool_name}</span>
                            <span className="text-gray-500 text-sm ml-2">
                              {c.plan_name}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 text-sm">
                            <span className="text-gray-400 line-through">
                              ${c.old_price}/seat
                            </span>
                            <span className="text-white font-semibold">
                              ${c.new_price}/seat
                            </span>
                            <span
                              className={`font-bold text-xs px-2 py-0.5 rounded-full ${
                                up
                                  ? "bg-red-500/20 text-red-400"
                                  : "bg-green-500/20 text-green-400"
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
              );
            })}
          </div>
        )}

        {/* ── Footer note ── */}
        <p className="text-gray-600 text-xs mt-10 text-center">
          Prices shown are per-seat per month at the time of detection.
          Historical data only — run a new audit to see current recommendations.
        </p>
      </div>
    </div>
  );
}
