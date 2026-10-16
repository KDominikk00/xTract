import { NextRequest, NextResponse } from "next/server";
import { getUserTier } from "@/lib/aiPlan";
import { normalizeSymbol } from "@/lib/symbols";
import { getUserFromRequest } from "@/lib/server/auth";
import { supabaseAdmin } from "@/lib/server/supabaseAdmin";

type FollowedBody = {
  symbol?: unknown;
};

export async function GET(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data, error } = await supabaseAdmin
      .from("followed_stocks")
      .select("symbol,created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json({ followed: data ?? [] });
  } catch (err) {
    console.error("Followed list error:", err);
    return NextResponse.json({ error: "Unable to load followed stocks." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json()) as FollowedBody;
    const symbol = normalizeSymbol(body.symbol);
    if (!symbol) {
      return NextResponse.json({ error: "Invalid symbol" }, { status: 400 });
    }

    const tier = getUserTier(user);
    const followLimit = tier === "pro" ? null : tier === "plus" ? 10 : 3;

    // Count + insert run in one SQL function under a per-user lock so concurrent follows cannot exceed the limit.
    const { data, error } = await supabaseAdmin.rpc("follow_stock", {
      p_user_id: user.id,
      p_symbol: symbol,
      p_limit: followLimit,
    });

    if (error) {
      throw new Error(error.message);
    }

    const result = (Array.isArray(data) ? data[0] : null) as { allowed: boolean } | null;
    if (!result) {
      throw new Error("Empty follow_stock response");
    }
    if (!result.allowed) {
      return NextResponse.json(
        { error: "Follow limit reached for your current plan.", limit: followLimit },
        { status: 403 }
      );
    }

    return NextResponse.json({ ok: true, symbol });
  } catch (err) {
    console.error("Follow symbol error:", err);
    return NextResponse.json({ error: "Unable to follow symbol." }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json()) as FollowedBody;
    const symbol = normalizeSymbol(body.symbol);
    if (!symbol) {
      return NextResponse.json({ error: "Invalid symbol" }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from("followed_stocks")
      .delete()
      .eq("user_id", user.id)
      .eq("symbol", symbol);

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json({ ok: true, symbol });
  } catch (err) {
    console.error("Unfollow symbol error:", err);
    return NextResponse.json({ error: "Unable to unfollow symbol." }, { status: 500 });
  }
}
