import { supabaseAdmin } from "@/lib/supabase";
import { getActiveOverrides } from "@/lib/current-pricing";

/**
 * /admin?secret=<ADMIN_SECRET>
 *
 * Server-rendered admin dashboard. Protected by the same ADMIN_SECRET
 * env var used by the API endpoints. If the secret is missing or wrong,
 * renders an access-denied page instead of throwing.
 *
 * Shows:
 * - Total audits stored
 * - Total leads captured
 * - Unsubscribed leads
 * - Pricing changes detected (total rows in pricing_changes)
 * - Active pricing overrides (current non-default prices)
 * - Recent pricing change log (last 20 entries)
 */
export const dynamic = "force-dynamic"; // always fetch fresh data

interface AdminStats {
  totalAudits: number;
  totalLeads: number;
  unsubscribedLeads: number;
  totalPricingChanges: number;
  recentChanges: Array<{
    id: string;
    tool_name: string;
    plan_name: string;
    old_price: number;
    new_price: number;
    detected_at: string;
  }>;
  activeOverrides: Array<{
    plan_id: string;
    tool_id: string;
    price_per_seat: number;
    updated_at: string;
  }>;
}

async function getStats(): Promise<AdminStats> {
  const [
    { count: totalAudits },
    { count: totalLeads },
    { count: unsubscribedLeads },
    { count: totalPricingChanges },
    { data: recentChanges },
    activeOverrides,
  ] = await Promise.all([
    supabaseAdmin.from("audits").select("*", { count: "exact", head: true }),
    supabaseAdmin.from("leads").select("*", { count: "exact", head: true }),
    supabaseAdmin
      .from("leads")
      .select("*", { count: "exact", head: true })
      .eq("unsubscribed", true),
    supabaseAdmin
      .from("pricing_changes")
      .select("*", { count: "exact", head: true }),
    supabaseAdmin
      .from("pricing_changes")
      .select("id, tool_name, plan_name, old_price, new_price, detected_at")
      .order("detected_at", { ascending: false })
      .limit(20),
    getActiveOverrides(),
  ]);

  return {
    totalAudits: totalAudits ?? 0,
    totalLeads: totalLeads ?? 0,
    unsubscribedLeads: unsubscribedLeads ?? 0,
    totalPricingChanges: totalPricingChanges ?? 0,
    recentChanges: recentChanges ?? [],
    activeOverrides,
  };
}

export default async function AdminPage({
  searchParams,
}: {
  searchParams: { secret?: string };
}) {
  const adminSecret = process.env.ADMIN_SECRET;

  // Gate: require secret in query string
  if (!adminSecret || searchParams.secret !== adminSecret) {
    return (
      <div className="min-h-screen bg-dark text-white flex items-center justify-center">
        <div className="bg-dark2 border border-red-500/30 rounded-xl p-8 max-w-sm text-center">
          <p className="text-red-400 font-bold text-lg mb-2">Access denied</p>
          <p className="text-gray-400 text-sm">
            Append{" "}
            <code className="text-gray-300">?secret=YOUR_ADMIN_SECRET</code> to
            the URL.
          </p>
        </div>
      </div>
    );
  }

  const stats = await getStats();

  return (
    <div className="min-h-screen bg-dark text-white">
      {/* ── Header ── */}
      <div className="border-b border-white/10 bg-dark2">
        <div className="max-w-5xl mx-auto px-4 py-5 flex items-center justify-between">
          <a href="/" className="text-green-400 font-bold text-lg tracking-tight">
            StackAudit
          </a>
          <span className="text-xs font-semibold bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full">
            ADMIN
          </span>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-10">
        <h1 className="text-2xl font-bold mb-8">Admin Dashboard</h1>

        {/* ── Stats grid ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
          <StatCard label="Total Audits" value={stats.totalAudits} />
          <StatCard label="Total Leads" value={stats.totalLeads} />
          <StatCard
            label="Unsubscribed"
            value={stats.unsubscribedLeads}
            sub={
              stats.totalLeads > 0
                ? `${Math.round((stats.unsubscribedLeads / stats.totalLeads) * 100)}%`
                : "0%"
            }
          />
          <StatCard
            label="Pricing Changes Logged"
            value={stats.totalPricingChanges}
          />
        </div>

        {/* ── Active overrides ── */}
        <Section title="Active Pricing Overrides">
          {stats.activeOverrides.length === 0 ? (
            <EmptyState text="No active overrides. All prices are at static defaults." />
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 text-xs uppercase tracking-wider border-b border-white/10">
                  <Th>Plan ID</Th>
                  <Th>Tool</Th>
                  <Th>Price / Seat</Th>
                  <Th>Updated</Th>
                </tr>
              </thead>
              <tbody>
                {stats.activeOverrides.map((o) => (
                  <tr key={o.plan_id} className="border-b border-white/5">
                    <Td>
                      <code className="text-xs text-gray-400">{o.plan_id}</code>
                    </Td>
                    <Td>{o.tool_id}</Td>
                    <Td className="text-yellow-400 font-semibold">
                      ${o.price_per_seat}/seat
                    </Td>
                    <Td className="text-gray-500">
                      {new Date(o.updated_at).toLocaleString("en-US", {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Section>

        {/* ── Recent pricing changes ── */}
        <Section title="Recent Pricing Changes Detected">
          {stats.recentChanges.length === 0 ? (
            <EmptyState text="No pricing changes detected yet. Trigger /api/detect-changes after updating a price." />
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 text-xs uppercase tracking-wider border-b border-white/10">
                  <Th>Tool</Th>
                  <Th>Plan</Th>
                  <Th>Old Price</Th>
                  <Th>New Price</Th>
                  <Th>Δ</Th>
                  <Th>Detected</Th>
                </tr>
              </thead>
              <tbody>
                {stats.recentChanges.map((c) => {
                  const up = c.new_price > c.old_price;
                  const delta = c.new_price - c.old_price;
                  return (
                    <tr key={c.id} className="border-b border-white/5">
                      <Td className="font-semibold">{c.tool_name}</Td>
                      <Td className="text-gray-400">{c.plan_name}</Td>
                      <Td className="text-gray-400 line-through">
                        ${c.old_price}
                      </Td>
                      <Td className="font-semibold">${c.new_price}</Td>
                      <Td
                        className={`font-bold ${
                          up ? "text-red-400" : "text-green-400"
                        }`}
                      >
                        {up ? "+" : ""}${delta}
                      </Td>
                      <Td className="text-gray-500">
                        {new Date(c.detected_at).toLocaleString("en-US", {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </Section>

        {/* ── Quick actions ── */}
        <Section title="Quick API Reference">
          <div className="space-y-3 text-sm text-gray-400">
            <ApiRef
              method="POST"
              path="/api/admin/update-pricing"
              desc='Set a price override. Body: { "planId": "cursor-pro", "toolId": "cursor", "newPrice": 25 }'
            />
            <ApiRef
              method="DELETE"
              path="/api/admin/update-pricing"
              desc='Remove an override. Body: { "planId": "cursor-pro" }'
            />
            <ApiRef
              method="POST"
              path="/api/detect-changes"
              desc="Run pricing-change detection and send notification emails."
            />
            <ApiRef
              method="GET"
              path="/changelog"
              desc="Public pricing history page."
            />
          </div>
          <p className="text-xs text-gray-600 mt-4">
            All POST/DELETE endpoints require{" "}
            <code className="text-gray-500">x-admin-secret: {"{ADMIN_SECRET}"}</code>{" "}
            header.
          </p>
        </Section>
      </div>
    </div>
  );
}

// ── Small reusable components ──

function StatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: number;
  sub?: string;
}) {
  return (
    <div className="bg-dark2 border border-white/10 rounded-xl p-5 text-center">
      <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">
        {label}
      </p>
      <p className="text-3xl font-bold">{value.toLocaleString()}</p>
      {sub && <p className="text-xs text-gray-500 mt-0.5">{sub}</p>}
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-8">
      <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">
        {title}
      </h2>
      <div className="bg-dark2 border border-white/10 rounded-xl p-5">
        {children}
      </div>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="py-2 pr-6 font-medium">{children}</th>;
}

function Td({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <td className={`py-3 pr-6 ${className}`}>{children}</td>;
}

function EmptyState({ text }: { text: string }) {
  return <p className="text-gray-500 text-sm">{text}</p>;
}

function ApiRef({
  method,
  path,
  desc,
}: {
  method: string;
  path: string;
  desc: string;
}) {
  const color =
    method === "POST"
      ? "text-blue-400"
      : method === "DELETE"
      ? "text-red-400"
      : "text-green-400";
  return (
    <div className="flex gap-3">
      <span className={`font-mono font-bold text-xs w-14 shrink-0 ${color}`}>
        {method}
      </span>
      <span className="font-mono text-xs text-gray-300 w-52 shrink-0">
        {path}
      </span>
      <span className="text-gray-500 text-xs">{desc}</span>
    </div>
  );
}
