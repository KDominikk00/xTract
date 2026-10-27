import { NextRequest, NextResponse } from "next/server";
import { getUserTier } from "@/lib/aiPlan";
import { getUserFromRequest } from "@/lib/server/auth";
import { getServerQuotaSnapshot } from "@/lib/server/aiQuota";

// Vercel function limit: stock API retries (cold start) and Gemini calls can take up to a minute.
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const tier = getUserTier(user);
    const quota = await getServerQuotaSnapshot(user.id, tier);
    return NextResponse.json({ quota, tier });
  } catch (err) {
    console.error("AI quota route error:", err);
    return NextResponse.json({ error: "Unable to load AI quota." }, { status: 500 });
  }
}
