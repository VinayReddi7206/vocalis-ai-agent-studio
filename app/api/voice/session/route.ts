import { NextResponse } from "next/server";
import { checkCallMissedBudget } from "../../../../lib/budget-guard";
import { requestIdentity, takeRateLimit } from "../../../../lib/rate-limit";

type VoiceResponse = {
  id?: string;
  ws_url?: string;
  token?: string;
  error?: { message?: string } | string;
  message?: string;
};

export async function POST(request: Request) {
  try {
    const rate = takeRateLimit(`voice:${requestIdentity(request)}`, 3, 60 * 60_000);
    if (!rate.allowed) {
      return NextResponse.json({ error: "Voice-session limit reached. Please try again later." }, { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } });
    }

    const apiKey = process.env.CALLMISSED_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Preview mode: add your replacement CallMissed key to .env.local to start a voice session." },
        { status: 503 },
      );
    }

    const baseUrl = (process.env.CALLMISSED_API_URL || "https://api.callmissed.com/v1").replace(/\/$/, "");
    const budget = await checkCallMissedBudget(apiKey, baseUrl);
    if (!budget.allowed) {
      return NextResponse.json({ error: `The $${budget.budgetUsd.toFixed(0)} project budget limit has been reached.` }, { status: 402 });
    }

    const upstream = await fetch(`${baseUrl}/voice/sessions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        system_prompt: "You are Vocalis, a concise and friendly voice assistant. Help the user think clearly and complete practical tasks. Never claim to perform actions you cannot perform.",
        greeting: "Hi, I’m Vocalis. What would you like to work on today?",
        voice: "shubh",
        language: "en-IN",
        llm_model: "sarvam-105b",
        stt_model: "saaras:v3",
        tts_model: "bulbul:v3",
        max_duration_seconds: 180,
        metadata: { source: "vocalis-web", budget_guard: "three-minute-limit" },
      }),
      signal: AbortSignal.timeout(30_000),
    });

    const data = (await upstream.json().catch(() => null)) as VoiceResponse | null;
    if (!upstream.ok) {
      const upstreamMessage = typeof data?.error === "string" ? data.error : data?.error?.message || data?.message;
      const friendly: Record<number, string> = {
        401: "The CallMissed key is invalid. Add the replacement key in .env.local.",
        402: "The CallMissed balance is insufficient. Voice sessions are paused.",
        403: "This key needs STT, TTS, and LLM permissions for voice sessions.",
        422: "The selected voice configuration is not available for this account.",
        429: "Too many voice sessions are active. Please wait a moment.",
        503: "The selected voice stack is temporarily unavailable.",
      };
      return NextResponse.json(
        { error: friendly[upstream.status] || upstreamMessage || "CallMissed could not create the voice session." },
        { status: upstream.status >= 400 && upstream.status < 600 ? upstream.status : 502 },
      );
    }

    if (!data?.id || !data.ws_url || !data.token) {
      return NextResponse.json({ error: "CallMissed returned an incomplete voice session." }, { status: 502 });
    }

    return NextResponse.json({ id: data.id, wsUrl: data.ws_url, token: data.token, maxDurationSeconds: 180 });
  } catch (error) {
    const timedOut = error instanceof Error && error.name === "TimeoutError";
    return NextResponse.json(
      { error: timedOut ? "Voice session creation timed out. Please try again." : "The voice session could not be created." },
      { status: timedOut ? 504 : 500 },
    );
  }
}
