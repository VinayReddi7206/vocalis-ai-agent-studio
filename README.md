# Vocalis — CallMissed AI Agent Studio

Vocalis is a full-stack web application for chatting with an AI, generating images, and speaking with a real-time voice agent through the CallMissed API.

## Four-day delivery plan

- **Day 1:** responsive product UI, secure server-side configuration, working chat route, local verification
- **Day 2:** CallMissed image generation, downloads, real-time WebRTC voice session, live transcript
- **Day 3:** usage dashboard, budget/rate protection, security hardening, AWS deployment preparation
- **Day 4:** final QA, documentation, demo video, GitHub and submission email

## Local setup

1. Install dependencies with `pnpm install`.
2. Copy `.env.example` to `.env.local`.
3. Put the replacement CallMissed key in `.env.local`.
4. Start the app with `pnpm dev`.

The API key is used only by server routes. It must never be added to browser code or committed to Git.

## Environment variables

| Variable | Purpose |
| --- | --- |
| `CALLMISSED_API_KEY` | Private CallMissed bearer token |
| `CALLMISSED_API_URL` | API base URL; defaults to `https://api.callmissed.com/v1` |
| `CALLMISSED_BUDGET_BASELINE_USD` | Existing account usage to subtract so the app tracks only project spend |

## Day 1 safety controls

- Chat requests are validated server-side.
- A request is limited to 20 messages and 4,000 characters per message.
- Responses are capped at 500 tokens to reduce accidental API spend.
- Upstream calls time out after 30 seconds.
- Common auth, permission, rate-limit, budget, and service errors have clear messages.
- The checked-in environment file contains placeholders only.

## Day 2 integrations

- Image generation uses `sdxl-lightning`, one 768×768 output, at roughly $0.04 per successful image.
- Voice sessions are created server-side and the API key never reaches the browser.
- The browser connects with the one-time WebRTC URL and JWT returned by CallMissed.
- Voice calls use the Shubh voice, English (India), and a three-minute maximum duration.
- Microphone audio and final transcript segments are handled by the LiveKit browser client.

## Day 3 production controls

- `/api/usage` combines CallMissed's 30-day usage summary and credit balance without exposing the API key.
- Paid requests perform a cached 90-day spend check and stop near the configured $20 limit.
- Per-client fixed-window limits protect chat, image generation, and voice-session creation.
- `/api/health` supports deployment readiness checks without calling a paid service.
- Security headers restrict framing, content types, browser permissions, and unexpected network destinations.
- `Dockerfile.aws` packages the standalone Next.js server with the AWS Lambda Web Adapter.
- Terraform provisions a low-concurrency Lambda Function URL, seven-day logs, and an optional $2 AWS budget alert.
- GitHub Actions verifies lint and the AWS production build on every pull request.

## Technology

- React 19 + TypeScript
- Next-compatible vinext full-stack runtime
- CallMissed API only for AI features
- Responsive custom CSS and Lucide icons

## Status

Day 1, Day 2, and the credential-free portion of Day 3 are implemented. A replacement API key is required for live CallMissed testing, and an authenticated AWS account is required for the final public deployment. Day 4 documentation and submission preparation remain.
