import { NextResponse } from "next/server";
import { checkCallMissedBudget } from "../../../lib/budget-guard";
import { requestIdentity, takeRateLimit } from "../../../lib/rate-limit";

type ChatMessage = { role: "user" | "assistant"; content: string };

function isMessage(value: unknown): value is ChatMessage {
  if (!value || typeof value !== "object") return false;
  const message = value as Record<string, unknown>;
  return (
    (message.role === "user" || message.role === "assistant") &&
    typeof message.content === "string" &&
    message.content.trim().length > 0 &&
    message.content.length <= 4000
  );
}

export async function POST(request: Request) {
  try {
    const rate = takeRateLimit(`chat:${requestIdentity(request)}`, 12, 60_000);
    if (!rate.allowed) {
      return NextResponse.json({ error: "Chat limit reached. Please wait before sending another message." }, { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } });
    }

    const body = (await request.json()) as { messages?: unknown };
    if (!Array.isArray(body.messages) || body.messages.length === 0 || body.messages.length > 20 || !body.messages.every(isMessage)) {
      return NextResponse.json({ error: "Please send between 1 and 20 valid messages." }, { status: 400 });
    }

    const apiKey = process.env.CALLMISSED_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Preview mode: add your replacement CallMissed key to .env.local to enable live chat." },
        { status: 503 },
      );
    }

    const baseUrl = (process.env.CALLMISSED_API_URL || "https://api.callmissed.com/v1").replace(/\/$/, "");
    const budget = await checkCallMissedBudget(apiKey, baseUrl);
    if (!budget.allowed) {
      return NextResponse.json({ error: `The $${budget.budgetUsd.toFixed(0)} project budget limit has been reached.` }, { status: 402 });
    }

    const upstream = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "sarvam-105b",
        messages: body.messages,
        max_tokens: 500,
        temperature: 0.7,
      }),
      signal: AbortSignal.timeout(30_000),
    });

    const data = (await upstream.json().catch(() => null)) as {
      choices?: Array<{ message?: { content?: string } }>;
      error?: { message?: string } | string;
      message?: string;
    } | null;

    if (!upstream.ok) {
      const upstreamMessage = typeof data?.error === "string" ? data.error : data?.error?.message || data?.message;
      const friendly: Record<number, string> = {
        401: "The CallMissed key is invalid. Add the replacement key in .env.local.",
        402: "The CallMissed budget is exhausted. Pause testing and check the account balance.",
        403: "This key does not have LLM permission enabled.",
        429: "The agent is receiving too many requests. Please wait a moment.",
        503: "CallMissed is temporarily unavailable. Please try again shortly.",
      };
      return NextResponse.json(
        { error: friendly[upstream.status] || upstreamMessage || "CallMissed could not complete this request." },
        { status: upstream.status >= 400 && upstream.status < 600 ? upstream.status : 502 },
      );
    }

    const message = data?.choices?.[0]?.message?.content?.trim();
    if (!message) return NextResponse.json({ error: "CallMissed returned an empty response." }, { status: 502 });
    return NextResponse.json({ message });
  } catch (error) {
    const timedOut = error instanceof Error && error.name === "TimeoutError";
    return NextResponse.json(
      { error: timedOut ? "The CallMissed request timed out. Please try again." : "The request could not be processed." },
      { status: timedOut ? 504 : 500 },
    );
  }
}
