"use client";

import {
  ArrowUp,
  AudioLines,
  BarChart3,
  Bot,
  Check,
  ChevronRight,
  CircleDollarSign,
  Copy,
  Download,
  Gauge,
  Image as ImageIcon,
  LoaderCircle,
  Menu,
  MessageCircle,
  Mic,
  PhoneOff,
  Plus,
  RefreshCcw,
  ShieldCheck,
  Sparkles,
  Volume2,
  WandSparkles,
  X,
} from "lucide-react";
import NextImage from "next/image";
import type { Room as LiveKitRoom } from "livekit-client";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

type Tab = "chat" | "image" | "voice" | "usage";
type Message = { role: "user" | "assistant"; content: string };

const starterPrompts = [
  "Plan a launch checklist for my app",
  "Write a friendly welcome message",
  "Explain Kubernetes in simple words",
];

export default function Home() {
  const [tab, setTab] = useState<Tab>("chat");
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [copied, setCopied] = useState<number | null>(null);

  const title = useMemo(
    () => ({ chat: "Chat", image: "Image Studio", voice: "Voice Agent", usage: "Usage & Health" })[tab],
    [tab],
  );

  async function submitMessage(event?: FormEvent) {
    event?.preventDefault();
    const content = input.trim();
    if (!content || loading) return;

    const nextMessages: Message[] = [...messages, { role: "user", content }];
    setMessages(nextMessages);
    setInput("");
    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: nextMessages }),
      });
      const data = (await response.json()) as { message?: string; error?: string };
      if (!response.ok) throw new Error(data.error || "The agent could not respond.");
      setMessages((current) => [
        ...current,
        { role: "assistant", content: data.message || "No response received." },
      ]);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  function chooseTab(nextTab: Tab) {
    setTab(nextTab);
    setMenuOpen(false);
  }

  async function copyMessage(content: string, index: number) {
    await navigator.clipboard.writeText(content);
    setCopied(index);
    window.setTimeout(() => setCopied(null), 1300);
  }

  return (
    <main className="app-shell">
      <aside className={`sidebar ${menuOpen ? "sidebar-open" : ""}`}>
        <div className="brand">
          <span className="brand-mark"><AudioLines size={21} /></span>
          <span>Vocalis</span>
          <button className="icon-button close-menu" onClick={() => setMenuOpen(false)} aria-label="Close menu"><X size={19} /></button>
        </div>

        <button className="new-session" onClick={() => { setMessages([]); setError(""); setInput(""); chooseTab("chat"); }}>
          <Plus size={17} /> New session
        </button>

        <nav className="nav-list" aria-label="Main navigation">
          <p className="nav-label">Workspace</p>
          <NavButton active={tab === "chat"} icon={<MessageCircle size={18} />} label="Chat" onClick={() => chooseTab("chat")} />
          <NavButton active={tab === "image"} icon={<ImageIcon size={18} />} label="Image studio" onClick={() => chooseTab("image")} />
          <NavButton active={tab === "voice"} icon={<Mic size={18} />} label="Voice agent" onClick={() => chooseTab("voice")} />
        </nav>

        <div className="sidebar-spacer" />

        <section className="budget-card">
          <div className="budget-head"><span>API budget</span><span>$0 / $20</span></div>
          <div className="budget-track"><span /></div>
          <p>Usage protection is enabled.</p>
        </section>

        <nav className="nav-list bottom-nav">
          <NavButton active={tab === "usage"} icon={<BarChart3 size={18} />} label="Usage & health" onClick={() => chooseTab("usage")} />
        </nav>
        <div className="profile">
          <span className="avatar">VK</span>
          <div><strong>Vinay Kumar</strong><span>Developer workspace</span></div>
          <ChevronRight size={17} />
        </div>
      </aside>

      {menuOpen && <button className="scrim" onClick={() => setMenuOpen(false)} aria-label="Close navigation" />}

      <section className="workspace">
        <header className="topbar">
          <div className="topbar-title">
            <button className="icon-button menu-button" onClick={() => setMenuOpen(true)} aria-label="Open menu"><Menu size={20} /></button>
            <div><span className="eyebrow">AI AGENT STUDIO</span><h1>{title}</h1></div>
          </div>
          <div className="status-pill"><span className="status-dot" /> CallMissed ready</div>
        </header>

        {tab === "chat" && (
          <section className="chat-stage">
            <div className="chat-feed">
              {messages.length === 0 ? (
                <div className="welcome">
                  <span className="welcome-icon"><Sparkles size={28} /></span>
                  <p className="overline">YOUR CREATIVE COPILOT</p>
                  <h2>What can we build together?</h2>
                  <p className="welcome-copy">Ask questions, shape ideas, or turn a rough thought into a practical plan. Your conversation stays focused and easy to follow.</p>
                  <div className="prompt-grid">
                    {starterPrompts.map((prompt) => (
                      <button key={prompt} onClick={() => setInput(prompt)}>
                        <span>{prompt}</span><ArrowUp size={16} />
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="messages">
                  {messages.map((message, index) => (
                    <article className={`message ${message.role}`} key={`${message.role}-${index}`}>
                      <span className="message-avatar">{message.role === "assistant" ? <Bot size={18} /> : "VK"}</span>
                      <div className="message-body">
                        <div className="message-meta"><strong>{message.role === "assistant" ? "Vocalis" : "You"}</strong><span>now</span></div>
                        <p>{message.content}</p>
                        {message.role === "assistant" && (
                          <button className="copy-button" onClick={() => copyMessage(message.content, index)}>
                            {copied === index ? <Check size={14} /> : <Copy size={14} />} {copied === index ? "Copied" : "Copy"}
                          </button>
                        )}
                      </div>
                    </article>
                  ))}
                  {loading && (
                    <article className="message assistant">
                      <span className="message-avatar"><Bot size={18} /></span>
                      <div className="message-body"><div className="message-meta"><strong>Vocalis</strong><span>thinking</span></div><div className="typing"><i /><i /><i /></div></div>
                    </article>
                  )}
                </div>
              )}
            </div>

            <div className="composer-wrap">
              {error && <div className="error-banner">{error}</div>}
              <form className="composer" onSubmit={submitMessage}>
                <textarea
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      void submitMessage();
                    }
                  }}
                  placeholder="Message Vocalis..."
                  rows={1}
                  maxLength={4000}
                  aria-label="Chat message"
                />
                <div className="composer-footer">
                  <span><Sparkles size={14} /> Powered by CallMissed</span>
                  <button type="submit" disabled={!input.trim() || loading} aria-label="Send message"><ArrowUp size={19} /></button>
                </div>
              </form>
              <p className="fine-print">Vocalis can make mistakes. Review important information.</p>
            </div>
          </section>
        )}

        {tab === "image" && <ImageStudio />}

        {tab === "voice" && <VoiceStudio />}

        {tab === "usage" && <UsageDashboard />}
      </section>
    </main>
  );
}

function NavButton({ active, icon, label, badge, onClick }: { active: boolean; icon: React.ReactNode; label: string; badge?: string; onClick: () => void }) {
  return <button className={`nav-button ${active ? "active" : ""}`} onClick={onClick}>{icon}<span>{label}</span>{badge && <small>{badge}</small>}</button>;
}

function ImageStudio() {
  const [prompt, setPrompt] = useState("");
  const [image, setImage] = useState("");
  const [usedPrompt, setUsedPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function generate(event: FormEvent) {
    event.preventDefault();
    const cleanPrompt = prompt.trim();
    if (!cleanPrompt || loading) return;
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/images", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: cleanPrompt }),
      });
      const data = (await response.json()) as { image?: string; revisedPrompt?: string | null; error?: string };
      if (!response.ok || !data.image) throw new Error(data.error || "The image could not be generated.");
      setImage(data.image);
      setUsedPrompt(data.revisedPrompt || cleanPrompt);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="studio-layout image-studio">
      <div className="studio-panel">
        <div className="studio-heading">
          <span className="studio-icon"><WandSparkles size={23} /></span>
          <div><p className="overline">IMAGE GENERATION</p><h2>Create something original.</h2></div>
        </div>
        <p className="studio-intro">Describe the visual you need. Vocalis uses the fast CallMissed image model and produces one budget-controlled image per request.</p>

        <form className="image-form" onSubmit={generate}>
          <label htmlFor="image-prompt">Your prompt</label>
          <textarea
            id="image-prompt"
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            placeholder="A modern voice assistant dashboard floating above a midnight city, soft violet light, editorial 3D style..."
            rows={6}
            maxLength={1000}
          />
          <div className="form-meta"><span>{prompt.length}/1000</span><span>~$0.04 per image</span></div>
          {error && <div className="error-banner">{error}</div>}
          <button className="generate-button" type="submit" disabled={!prompt.trim() || loading}>
            {loading ? <><LoaderCircle className="spin" size={18} /> Generating image...</> : <><Sparkles size={18} /> Generate image</>}
          </button>
        </form>

        <div className="model-strip">
          <div><span>Model</span><strong>SDXL Lightning</strong></div>
          <div><span>Size</span><strong>768 × 768</strong></div>
          <div><span>Outputs</span><strong>1 image</strong></div>
        </div>
      </div>

      <div className="canvas-panel">
        {image ? (
          <div className="generated-result">
            <div className="generated-image"><NextImage src={image} alt={usedPrompt || "Generated artwork"} width={768} height={768} unoptimized /></div>
            <div className="result-footer">
              <div><strong>Generated with Vocalis</strong><span>{usedPrompt}</span></div>
              <div className="result-actions">
                <button onClick={() => { setImage(""); setError(""); }} aria-label="Generate another image"><RefreshCcw size={17} /></button>
                <a href={image} download="vocalis-generated-image.png" aria-label="Download generated image"><Download size={17} /></a>
              </div>
            </div>
          </div>
        ) : (
          <div className={`canvas-empty ${loading ? "is-loading" : ""}`}>
            <div className="canvas-orb"><ImageIcon size={34} /></div>
            <strong>{loading ? "Creating your image" : "Your canvas is ready"}</strong>
            <p>{loading ? "CallMissed is turning your description into pixels. This can take a moment." : "Write a prompt and your generated image will appear here."}</p>
            {loading && <div className="loading-line"><span /></div>}
          </div>
        )}
      </div>
    </section>
  );
}

type VoiceStatus = "idle" | "connecting" | "active";
type TranscriptLine = { speaker: "You" | "Vocalis"; text: string };

function VoiceStudio() {
  const [status, setStatus] = useState<VoiceStatus>("idle");
  const [error, setError] = useState("");
  const [seconds, setSeconds] = useState(0);
  const [transcript, setTranscript] = useState<TranscriptLine[]>([]);
  const roomRef = useRef<LiveKitRoom | null>(null);
  const audioElementsRef = useRef<HTMLElement[]>([]);

  function cleanAudio() {
    for (const element of audioElementsRef.current) element.remove();
    audioElementsRef.current = [];
  }

  useEffect(() => {
    if (status !== "active") return;
    const interval = window.setInterval(() => setSeconds((current) => current + 1), 1000);
    return () => window.clearInterval(interval);
  }, [status]);

  useEffect(() => () => {
    roomRef.current?.disconnect();
    for (const element of audioElementsRef.current) element.remove();
  }, []);

  async function startVoice() {
    if (status !== "idle") return;
    setStatus("connecting");
    setError("");
    setTranscript([]);
    setSeconds(0);

    try {
      const response = await fetch("/api/voice/session", { method: "POST" });
      const data = (await response.json()) as { wsUrl?: string; token?: string; error?: string };
      if (!response.ok || !data.wsUrl || !data.token) throw new Error(data.error || "The voice session could not start.");

      const { Room, RoomEvent, Track } = await import("livekit-client");
      const room = new Room();
      roomRef.current = room;
      room.on(RoomEvent.TrackSubscribed, (track) => {
        if (track.kind === Track.Kind.Audio) {
          const element = track.attach();
          element.setAttribute("data-vocalis-audio", "true");
          document.body.appendChild(element);
          audioElementsRef.current.push(element);
        }
      });
      room.on(RoomEvent.TranscriptionReceived, (segments, participant) => {
        const finalLines = segments
          .filter((segment) => segment.final && segment.text.trim())
          .map((segment) => ({ speaker: participant?.isLocal ? "You" as const : "Vocalis" as const, text: segment.text.trim() }));
        if (finalLines.length) setTranscript((current) => [...current, ...finalLines]);
      });
      room.on(RoomEvent.Disconnected, () => {
        setStatus("idle");
        cleanAudio();
      });

      await room.connect(data.wsUrl, data.token);
      await room.localParticipant.setMicrophoneEnabled(true);
      setStatus("active");
    } catch (requestError) {
      roomRef.current?.disconnect();
      roomRef.current = null;
      cleanAudio();
      setStatus("idle");
      setError(requestError instanceof Error ? requestError.message : "Something went wrong.");
    }
  }

  function endVoice() {
    roomRef.current?.disconnect();
    roomRef.current = null;
    cleanAudio();
    setStatus("idle");
  }

  const time = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;

  return (
    <section className="studio-layout voice-studio">
      <div className="voice-stage">
        <div className={`voice-orb ${status}`}>
          <span className="orb-ring ring-one" /><span className="orb-ring ring-two" />
          <div><Volume2 size={32} /></div>
        </div>
        <p className="overline">REAL-TIME VOICE</p>
        <h2>{status === "active" ? "Vocalis is listening" : status === "connecting" ? "Connecting securely" : "Talk through your ideas."}</h2>
        <p className="voice-copy">A low-latency WebRTC conversation with transcription, natural responses, and interruption support.</p>

        <div className={`live-wave ${status === "active" ? "playing" : ""}`} aria-hidden="true">
          {[20, 36, 54, 28, 68, 42, 78, 38, 58, 31, 49, 24, 41, 18].map((height, index) => <i key={index} style={{ height }} />)}
        </div>

        {status === "active" ? (
          <div className="voice-controls"><span className="timer"><i /> LIVE {time}</span><button className="end-call" onClick={endVoice}><PhoneOff size={18} /> End session</button></div>
        ) : (
          <button className="start-call" onClick={startVoice} disabled={status === "connecting"}>
            {status === "connecting" ? <><LoaderCircle className="spin" size={19} /> Creating session...</> : <><Mic size={19} /> Start voice session</>}
          </button>
        )}
        {error && <div className="error-banner voice-error">{error}</div>}
        <div className="voice-notes"><span><Check size={14} /> 3-minute safety cap</span><span><Check size={14} /> Encrypted WebRTC audio</span><span><Check size={14} /> API key stays server-side</span></div>
      </div>

      <aside className="transcript-panel">
        <div className="transcript-head"><div><span className="status-dot" /><strong>Live transcript</strong></div><span>{transcript.length} lines</span></div>
        <div className="transcript-feed">
          {transcript.length ? transcript.map((line, index) => (
            <div className="transcript-line" key={`${line.speaker}-${index}`}><span>{line.speaker === "You" ? "VK" : <Bot size={15} />}</span><div><strong>{line.speaker}</strong><p>{line.text}</p></div></div>
          )) : (
            <div className="transcript-empty"><AudioLines size={29} /><strong>Your conversation will appear here</strong><p>Start a session and speak naturally. Final transcript segments are added automatically.</p></div>
          )}
        </div>
        <div className="transcript-foot"><span>English (India)</span><span>Shubh voice</span></div>
      </aside>
    </section>
  );
}

type UsageSnapshot = {
  configured: boolean;
  usageEnabled: boolean;
  budgetUsd: number;
  spendUsd: number;
  remainingUsd: number;
  balanceCredits: number | null;
  totalRequests: number;
  successRate: number | null;
  audioSeconds: number;
  avgLatencyMs: number | null;
  byService: Array<{ service: string; requests: number; cost_usd: number }>;
  series: Array<{ date: string; requests: number; cost_usd: number }>;
  warning?: string | null;
};

function UsageDashboard() {
  const [usage, setUsage] = useState<UsageSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadUsage() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/usage", { cache: "no-store" });
      const data = (await response.json()) as UsageSnapshot & { error?: string };
      if (!response.ok) throw new Error(data.error || "Usage data could not be loaded.");
      setUsage(data);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadUsage(); }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const budgetPercent = usage ? Math.min(100, (usage.spendUsd / Math.max(usage.budgetUsd, 1)) * 100) : 0;
  const maxDailyCost = Math.max(1, ...(usage?.series.map((item) => item.cost_usd) || []));

  return (
    <section className="usage-page">
      <div className="usage-title-row">
        <div><p className="overline">COST CONTROL</p><h2>Usage & system health</h2><p>Monitor the project budget, API activity, and deployment readiness from one place.</p></div>
        <button className="refresh-usage" onClick={loadUsage} disabled={loading}><RefreshCcw className={loading ? "spin" : ""} size={16} /> Refresh</button>
      </div>

      {error && <div className="error-banner">{error}</div>}
      {usage && !usage.configured && <div className="usage-notice"><ShieldCheck size={18} /><div><strong>Safe preview mode</strong><span>Add the replacement CallMissed key later to load live usage. No secret is currently stored.</span></div></div>}
      {usage?.warning && <div className="usage-notice warning"><Gauge size={18} /><div><strong>Detailed metering unavailable</strong><span>{usage.warning}</span></div></div>}

      <div className="metric-grid">
        <MetricCard icon={<CircleDollarSign size={19} />} label="30-day spend" value={usage ? `$${usage.spendUsd.toFixed(2)}` : "—"} note={`$${usage?.remainingUsd.toFixed(2) || "20.00"} remaining`} />
        <MetricCard icon={<BarChart3 size={19} />} label="API requests" value={usage ? usage.totalRequests.toLocaleString() : "—"} note="Across all services" />
        <MetricCard icon={<ShieldCheck size={19} />} label="Success rate" value={usage?.successRate === null || usage?.successRate === undefined ? "—" : `${(usage.successRate * 100).toFixed(1)}%`} note="Last 30 days" />
        <MetricCard icon={<Gauge size={19} />} label="Average latency" value={usage?.avgLatencyMs ? `${Math.round(usage.avgLatencyMs)} ms` : "—"} note={usage?.balanceCredits === null || usage?.balanceCredits === undefined ? "Balance unavailable" : `${usage.balanceCredits.toFixed(1)} credits balance`} />
      </div>

      <div className="usage-grid">
        <section className="usage-card budget-overview">
          <div className="card-heading"><div><strong>Project budget</strong><span>Automatic guard checks the 90-day total</span></div><span>${usage?.budgetUsd.toFixed(0) || "20"} limit</span></div>
          <div className="budget-visual"><div className="budget-ring" style={{ "--budget": `${budgetPercent * 3.6}deg` } as React.CSSProperties}><div><strong>{budgetPercent.toFixed(0)}%</strong><span>used</span></div></div><div className="budget-detail"><strong>${usage?.spendUsd.toFixed(2) || "0.00"}</strong><span>spent in the last 30 days</span><p>The app stops new paid requests before the configured limit and keeps a $0.25 safety reserve.</p></div></div>
        </section>

        <section className="usage-card daily-chart">
          <div className="card-heading"><div><strong>Daily spend</strong><span>Latest 30-day usage window</span></div></div>
          <div className="bar-chart">
            {usage?.series.length ? usage.series.slice(-14).map((item) => <div className="bar-column" key={item.date}><span title={`$${item.cost_usd.toFixed(3)}`} style={{ height: `${Math.max(5, (item.cost_usd / maxDailyCost) * 100)}%` }} /><small>{item.date.slice(5)}</small></div>) : <div className="chart-empty">Usage bars will appear after live API testing.</div>}
          </div>
        </section>

        <section className="usage-card service-table">
          <div className="card-heading"><div><strong>Spend by service</strong><span>Chat, image, speech, and voice</span></div></div>
          <div className="service-rows">
            {usage?.byService.length ? usage.byService.map((service) => <div key={service.service}><span className="service-name"><i>{service.service.slice(0, 2).toUpperCase()}</i><strong>{service.service}</strong></span><span>{service.requests.toLocaleString()} requests</span><strong>${service.cost_usd.toFixed(3)}</strong></div>) : <div className="service-empty">No metered requests yet.</div>}
          </div>
        </section>

        <section className="usage-card health-card">
          <div className="card-heading"><div><strong>Production safeguards</strong><span>Enabled in the current build</span></div></div>
          <div className="health-list">
            <span><Check size={15} /><span><strong>Budget preflight</strong><small>Cached 60-second spend check</small></span></span>
            <span><Check size={15} /><span><strong>Rate protection</strong><small>Separate limits for chat, image, and voice</small></span></span>
            <span><Check size={15} /><span><strong>Health endpoint</strong><small>Deployment-ready readiness checks</small></span></span>
            <span><Check size={15} /><span><strong>Security headers</strong><small>CSP, frame, content, and permission policies</small></span></span>
          </div>
        </section>
      </div>
    </section>
  );
}

function MetricCard({ icon, label, value, note }: { icon: React.ReactNode; label: string; value: string; note: string }) {
  return <article className="metric-card"><span>{icon}</span><div><small>{label}</small><strong>{value}</strong><p>{note}</p></div></article>;
}
