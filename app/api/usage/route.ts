import { NextResponse } from "next/server";

type UsageSummary = {
  period_days?: number;
  totals?: {
    total_requests?: number;
    success?: number;
    errors?: number;
    success_rate?: number;
    total_cost_usd?: number;
    total_audio_seconds?: number;
    avg_latency_ms?: number;
  };
  by_service?: Array<{ service: string; requests: number; cost_usd: number }>;
  series?: Array<{ date: string; requests: number; cost_usd: number }>;
};

export async function GET() {
  const budgetUsd = Number(process.env.CALLMISSED_BUDGET_USD || "20");
  const apiKey = process.env.CALLMISSED_API_KEY;
  if (!apiKey) {
    return NextResponse.json({
      configured: false,
      usageEnabled: false,
      budgetUsd,
      spendUsd: 0,
      remainingUsd: budgetUsd,
      balanceCredits: null,
      totalRequests: 0,
      successRate: null,
      audioSeconds: 0,
      avgLatencyMs: null,
      byService: [],
      series: [],
    }, { headers: { "Cache-Control": "no-store" } });
  }

  const baseUrl = (process.env.CALLMISSED_API_URL || "https://api.callmissed.com/v1").replace(/\/$/, "");
  try {
    const [summaryResponse, balanceResponse] = await Promise.all([
      fetch(`${baseUrl}/usage/summary?days=30`, { headers: { Authorization: `Bearer ${apiKey}` }, signal: AbortSignal.timeout(10_000) }),
      fetch(`${baseUrl}/credits/balance`, { headers: { Authorization: `Bearer ${apiKey}` }, signal: AbortSignal.timeout(10_000) }),
    ]);

    if (summaryResponse.status === 401 || balanceResponse.status === 401) {
      return NextResponse.json({ error: "The configured CallMissed key is invalid." }, { status: 401 });
    }

    const summary = summaryResponse.ok ? (await summaryResponse.json()) as UsageSummary : null;
    const balance = balanceResponse.ok ? (await balanceResponse.json()) as { balance?: number } : null;
    const baselineUsd = Number(process.env.CALLMISSED_BUDGET_BASELINE_USD || 0);
    const spendUsd = Math.max(0, Number(summary?.totals?.total_cost_usd || 0) - baselineUsd);

    return NextResponse.json({
      configured: true,
      usageEnabled: summaryResponse.ok,
      budgetUsd,
      spendUsd,
      remainingUsd: Math.max(0, budgetUsd - spendUsd),
      balanceCredits: typeof balance?.balance === "number" ? balance.balance : null,
      totalRequests: summary?.totals?.total_requests || 0,
      successRate: typeof summary?.totals?.success_rate === "number" ? summary.totals.success_rate : null,
      audioSeconds: summary?.totals?.total_audio_seconds || 0,
      avgLatencyMs: summary?.totals?.avg_latency_ms || null,
      byService: summary?.by_service || [],
      series: summary?.series || [],
      warning: summaryResponse.status === 403 ? "Add usage:read permission to display detailed usage." : null,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "CallMissed usage data is temporarily unavailable." }, { status: 502 });
  }
}
