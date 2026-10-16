// One-off migration: copy each subscriber's plan into app_metadata (service-role only).
//
// The app now trusts only app_metadata.tier; older accounts have the tier in user_metadata, so paying
// users would read as "free" until their next Stripe event. This recomputes the tier from
// user_subscriptions (the same rule as the webhook: highest active/trialing tier wins).
//
// Dry run (default, writes nothing):
//   node --env-file=.env.local scripts/backfill-tiers.mjs
// Apply:
//   node --env-file=.env.local scripts/backfill-tiers.mjs --apply
import { createClient } from "@supabase/supabase-js";

const apply = process.argv.includes("--apply");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY (use --env-file=.env.local).");
  process.exit(1);
}

const supabase = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
const RANK = { free: 0, plus: 1, pro: 2 };

async function loadSubscriptions() {
  const rows = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from("user_subscriptions")
      .select("user_id,tier,status")
      .range(from, from + pageSize - 1);
    if (error) throw new Error(`Failed to load subscriptions: ${error.message}`);
    rows.push(...data);
    if (data.length < pageSize) return rows;
  }
}

const effectiveTiers = new Map();
for (const row of await loadSubscriptions()) {
  const current = effectiveTiers.get(row.user_id) ?? "free";
  const active = row.status === "active" || row.status === "trialing";
  effectiveTiers.set(row.user_id, active && RANK[row.tier] > RANK[current] ? row.tier : current);
}

let changed = 0;
let unchanged = 0;
for (const [userId, tier] of effectiveTiers) {
  const { data, error } = await supabase.auth.admin.getUserById(userId);
  if (error || !data.user) {
    console.warn(`skip ${userId}: ${error?.message ?? "user not found"}`);
    continue;
  }

  const appMetadata = data.user.app_metadata ?? {};
  if (appMetadata.tier === tier && appMetadata.plan === tier) {
    unchanged += 1;
    continue;
  }

  console.log(`${apply ? "set" : "would set"} ${userId}: ${appMetadata.tier ?? "(none)"} -> ${tier}`);
  changed += 1;
  if (!apply) continue;

  const { error: updateError } = await supabase.auth.admin.updateUserById(userId, {
    app_metadata: { ...appMetadata, tier, plan: tier },
  });
  if (updateError) console.error(`failed ${userId}: ${updateError.message}`);
}

console.log(`\n${apply ? "Applied" : "Dry run"}: ${changed} to change, ${unchanged} already correct.`);
if (!apply && changed > 0) console.log("Re-run with --apply to write the changes.");
