type BudgetSnapshot = {
  allowed: boolean;
  checked: boolean;
  budgetUsd: number;
  spentUsd: number | null;
};

let cached: { expiresAt: number; value: BudgetSnapshot } | null = null;

export async function checkCallMissedBudget(apiKey: string, baseUrl: string): Promise<BudgetSnapshot> {
  const budgetUsd = Number(process.env.CALLMISSED_BUDGET_USD || "20");
  const reserveUsd = Number(process.env.CALLMISSED_BUDGET_RESERVE_USD || "0.25");
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  try {
    const response = await fetch(`${baseUrl}/usage/summary?days=30`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) return { allowed: true, checked: false, budgetUsd, spentUsd: null };

    const data = (await response.json()) as { totals?: { total_cost_usd?: number } };
    const baselineUsd = Number(process.env.CALLMISSED_BUDGET_BASELINE_USD || 0);
    const spentUsd = Math.max(0, Number(data.totals?.total_cost_usd || 0) - baselineUsd);
    const value = { allowed: spentUsd < Math.max(0, budgetUsd - reserveUsd), checked: true, budgetUsd, spentUsd };
    cached = { expiresAt: Date.now() + 60_000, value };
    return value;
  } catch {
    return { allowed: true, checked: false, budgetUsd, spentUsd: null };
  }
}
