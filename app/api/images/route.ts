import { NextResponse } from "next/server";
import { checkCallMissedBudget } from "../../../lib/budget-guard";
import { requestIdentity, takeRateLimit } from "../../../lib/rate-limit";

type ImageResponse = {
  data?: Array<{ b64_json?: string; url?: string; revised_prompt?: string | null }>;
  error?: { message?: string } | string;
  message?: string;
};

export async function POST(request: Request) {
  try {
    const rate = takeRateLimit(`image:${requestIdentity(request)}`, 4, 10 * 60_000);
    if (!rate.allowed) {
      return NextResponse.json({ error: "Image limit reached. Please wait before generating again." }, { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } });
    }

    const body = (await request.json()) as { prompt?: unknown };
    const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
    if (!prompt || prompt.length > 1000) {
      return NextResponse.json({ error: "Use an image prompt between 1 and 1,000 characters." }, { status: 400 });
    }

    const apiKey = process.env.CALLMISSED_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Preview mode: add your replacement CallMissed key to .env.local to generate images." },
        { status: 503 },
      );
    }

    const baseUrl = (process.env.CALLMISSED_API_URL || "https://api.callmissed.com/v1").replace(/\/$/, "");
    const budget = await checkCallMissedBudget(apiKey, baseUrl);
    if (!budget.allowed) {
      return NextResponse.json({ error: `The $${budget.budgetUsd.toFixed(0)} project budget limit has been reached.` }, { status: 402 });
    }

    const upstream = await fetch(`${baseUrl}/images/generations`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "sdxl-lightning",
        prompt,
        n: 1,
        size: "768x768",
        response_format: "b64_json",
      }),
      signal: AbortSignal.timeout(90_000),
    });

    const data = (await upstream.json().catch(() => null)) as ImageResponse | null;
    if (!upstream.ok) {
      const upstreamMessage = typeof data?.error === "string" ? data.error : data?.error?.message || data?.message;
      const friendly: Record<number, string> = {
        400: "The image request was rejected. Try a simpler prompt.",
        401: "The CallMissed key is invalid. Add the replacement key in .env.local.",
        402: "The CallMissed budget is exhausted. Image generation has been paused.",
        403: "This key needs image permission or access to the selected model.",
        422: "The image settings were not accepted. Try a different prompt.",
        429: "The image service is busy. Please wait before generating again.",
        503: "The selected image model is temporarily unavailable.",
      };
      return NextResponse.json(
        { error: friendly[upstream.status] || upstreamMessage || "CallMissed could not generate this image." },
        { status: upstream.status >= 400 && upstream.status < 600 ? upstream.status : 502 },
      );
    }

    const result = data?.data?.[0];
    const image = result?.b64_json ? `data:image/png;base64,${result.b64_json}` : result?.url;
    if (!image) return NextResponse.json({ error: "CallMissed returned no image data." }, { status: 502 });

    return NextResponse.json({ image, revisedPrompt: result?.revised_prompt || null, model: "sdxl-lightning" });
  } catch (error) {
    const timedOut = error instanceof Error && error.name === "TimeoutError";
    return NextResponse.json(
      { error: timedOut ? "Image generation timed out. No charge should be applied; please retry." : "The image request could not be processed." },
      { status: timedOut ? 504 : 500 },
    );
  }
}
