"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Post, type FilteredPost } from "@/components/Post";

export default function Home() {
  const [prompt, setPrompt] = useState("");
  const [rate, setRate] = useState(10);
  const [isStreaming, setIsStreaming] = useState(false);
  const [posts, setPosts] = useState<FilteredPost[]>([]);
  const [status, setStatus] = useState("");
  const [bufferSize, setBufferSize] = useState(0);
  const [phase, setPhase] = useState<"hero" | "exiting" | "feed">("hero");

  const bufferRef = useRef<FilteredPost[]>([]);
  const eventSourceRef = useRef<EventSource | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const newestPostIdRef = useRef<string | null>(null);

  /* ── drip timer ─────────────────────────────────── */

  const startDrip = useCallback((postsPerMin: number) => {
    if (timerRef.current) clearInterval(timerRef.current);
    const intervalMs = Math.max((60 / postsPerMin) * 1000, 100);
    timerRef.current = setInterval(() => {
      if (bufferRef.current.length > 0) {
        const post = bufferRef.current.shift()!;
        newestPostIdRef.current = post.post.uri;
        setPosts((prev) => [post, ...prev].slice(0, 200));
        setBufferSize(bufferRef.current.length);
      }
    }, intervalMs);
  }, []);

  useEffect(() => {
    if (isStreaming) startDrip(rate);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [rate, isStreaming, startDrip]);

  /* ── stream controls ────────────────────────────── */

  const startStream = useCallback(() => {
    const trimmed = prompt.trim();
    if (!trimmed) return;

    eventSourceRef.current?.close();
    if (timerRef.current) clearInterval(timerRef.current);

    bufferRef.current = [];
    setPosts([]);
    setBufferSize(0);
    setIsStreaming(true);
    setStatus("Connecting to firehose...");

    const params = new URLSearchParams({
      prompt: trimmed,
      matchesPerBatch: "5",
      batchSize: "100",
    });

    const es = new EventSource(`/api/stream?${params}`);
    eventSourceRef.current = es;

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "connected") {
          setStatus("Connected \u2014 scanning for matches\u2026");
          return;
        }
        bufferRef.current.push(data as FilteredPost);
        setBufferSize(bufferRef.current.length);
      } catch {
        // skip
      }
    };

    es.addEventListener("error", () => {
      if (es.readyState === EventSource.CLOSED) {
        setStatus("Connection closed");
        setIsStreaming(false);
      } else {
        setStatus("Reconnecting\u2026");
      }
    });

    startDrip(rate);
  }, [prompt, rate, startDrip]);

  const stopStream = useCallback(() => {
    eventSourceRef.current?.close();
    eventSourceRef.current = null;
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    setIsStreaming(false);
    setStatus(
      posts.length > 0
        ? `Stopped \u2014 ${posts.length} posts shown`
        : "Stopped"
    );
  }, [posts.length]);

  useEffect(() => {
    return () => {
      eventSourceRef.current?.close();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  /* ── phase transitions ──────────────────────────── */

  const handleStart = useCallback(() => {
    if (!prompt.trim()) return;
    setPhase("exiting");
    setTimeout(() => {
      setPhase("feed");
      startStream();
    }, 700);
  }, [prompt, startStream]);

  const handleNewSearch = useCallback(() => {
    stopStream();
    setPosts([]);
    setPrompt("");
    setBufferSize(0);
    setStatus("");
    setPhase("hero");
  }, [stopStream]);

  const rateLabel =
    rate >= 60 ? "1/sec" : rate === 1 ? "1/min" : `${rate}/min`;

  /* ── HERO ───────────────────────────────────────── */

  if (phase === "hero" || phase === "exiting") {
    return (
      <div className="fixed inset-0 overflow-hidden bg-black">
        {/* video background */}
        <video
          autoPlay
          muted
          loop
          playsInline
          className="absolute inset-0 w-full h-full object-cover opacity-80"
        >
          <source src="/spinner.mp4" type="video/mp4" />
        </video>

        {/* gradient vignette */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/40" />

        {/* content */}
        <div
          className={`relative z-10 flex flex-col items-center justify-center h-full px-6 ${phase === "exiting" ? "animate-hero-exit" : ""
            }`}
        >
          <h1
            className="font-[family-name:var(--font-cinzel)] text-4xl sm:text-5xl md:text-6xl font-bold text-white text-center mb-3 animate-fade-in-up"
            style={{
              textShadow:
                "0 0 40px rgba(0,133,255,0.5), 0 0 80px rgba(0,133,255,0.2)",
            }}
          >
            What do you want to see on Bluesky?
          </h1>

          <p
            className="text-blue-200/50 text-sm sm:text-base text-center mb-10 animate-fade-in-up"
            style={{ animationDelay: "0.15s" }}
          >
            Filter the firehose in real time
          </p>

          <div
            className="w-full max-w-lg flex flex-col sm:flex-row gap-3 animate-fade-in-up"
            style={{ animationDelay: "0.3s" }}
          >
            <input
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleStart();
              }}
              placeholder={`AI hot takes, cute pets, sports news...`}
              className="flex-1 px-5 py-3.5 rounded-xl bg-white/[0.08] border border-white/[0.15] text-white placeholder-white/25 text-base focus:outline-none focus:border-[#0085ff]/50 focus:bg-white/[0.1] transition-all backdrop-blur-sm"
              autoFocus
            />
            <button
              onClick={handleStart}
              disabled={!prompt.trim()}
              className={`px-10 py-3.5 rounded-xl text-white font-bold text-lg tracking-wide transition-all cursor-pointer ${prompt.trim()
                  ? "bg-[#1a9fff] hover:bg-[#0090ff] animate-glow-pulse border border-white/30 shadow-[0_0_24px_rgba(0,144,255,0.45)]"
                  : "bg-white/[0.06] opacity-30 cursor-not-allowed"
                }`}
            >
              Start
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ── FEED ───────────────────────────────────────── */

  return (
    <div className="min-h-screen bg-[#060a13] animate-fade-in">
      {/* header */}
      <header className="sticky top-0 z-50 glass border-b border-white/[0.06]">
        <div className="max-w-[600px] mx-auto px-4 py-3">
          <div className="flex items-center gap-3 mb-2">
            {/* bluesky logo */}
            <svg
              className="w-5 h-5 text-[#0085ff] shrink-0"
              viewBox="0 0 360 320"
              fill="currentColor"
            >
              <path d="M254.896 184.158C252.81 166.92 250.724 149.682 248.638 132.444C246.552 115.206 244.466 97.968 242.38 80.73C240.294 63.492 238.208 46.254 236.122 29.016C234.036 11.778 231.95 -5.46 229.864 -22.698L229.864 -22.698C229.35 -26.986 224.176 -29.148 220.884 -26.292L220.884 -26.292C209.124 -16.098 197.364 -5.904 185.604 4.29C173.844 14.484 162.084 24.678 150.324 34.872C138.564 45.066 126.804 55.26 115.044 65.454C103.284 75.648 91.524 85.842 79.764 96.036L79.764 96.036C78.162 97.422 78.162 99.918 79.764 101.304L79.764 101.304C91.524 111.498 103.284 121.692 115.044 131.886C126.804 142.08 138.564 152.274 150.324 162.468C162.084 172.662 173.844 182.856 185.604 193.05C197.364 203.244 209.124 213.438 220.884 223.632L220.884 223.632C224.176 226.488 229.35 224.326 229.864 220.038L229.864 220.038C231.95 202.8 234.036 185.562 236.122 168.324C238.208 151.086 240.294 133.848 242.38 116.61C244.466 99.372 246.552 82.134 248.638 64.896C250.724 47.658 252.81 30.42 254.896 13.182" />
            </svg>

            {/* current prompt */}
            <span className="text-sm text-white/35 truncate flex-1 italic">
              &ldquo;{prompt}&rdquo;
            </span>

            {/* live indicator */}
            {isStreaming && (
              <span className="flex items-center gap-1.5 text-xs text-emerald-400 shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Live
              </span>
            )}

            {/* stop / new search */}
            {isStreaming ? (
              <button
                onClick={stopStream}
                className="px-4 py-1.5 rounded-lg bg-red-500/15 text-red-400 text-xs font-medium hover:bg-red-500/25 transition-colors shrink-0 cursor-pointer"
              >
                Stop
              </button>
            ) : (
              <button
                onClick={handleNewSearch}
                className="px-4 py-1.5 rounded-lg bg-[#0085ff]/15 text-[#0085ff] text-xs font-medium hover:bg-[#0085ff]/25 transition-colors shrink-0 cursor-pointer"
              >
                New Search
              </button>
            )}
          </div>

          {/* speed slider */}
          <div className="flex items-center gap-3">
            <label className="text-xs text-white/25 min-w-[4.5rem]">
              Speed: {rateLabel}
            </label>
            <input
              type="range"
              min="1"
              max="60"
              value={rate}
              onChange={(e) => setRate(parseInt(e.target.value, 10))}
              className="flex-1"
            />
            {bufferSize > 0 && (
              <span className="text-[11px] text-white/20 tabular-nums whitespace-nowrap">
                {bufferSize} queued
              </span>
            )}
          </div>

          {status && (
            <p className="text-[11px] text-white/20 mt-1">{status}</p>
          )}
        </div>
      </header>

      {/* posts */}
      <main className="max-w-[600px] mx-auto bg-[#0d1117] min-h-[calc(100vh-100px)] border-x border-white/[0.04]">
        {posts.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 px-4 text-white/25">
            <div className="w-8 h-8 border-2 border-white/10 border-t-[#0085ff] rounded-full animate-spin mb-4" />
            <p className="text-sm">Scanning the firehose for matches&hellip;</p>
            <p className="text-xs mt-1 text-white/15">
              This may take a moment as posts are batched and filtered
            </p>
          </div>
        )}
        {posts.map((post, i) => (
          <Post
            key={post.post.uri + post.post.cid}
            data={post}
            isNew={i === 0 && post.post.uri === newestPostIdRef.current}
          />
        ))}
      </main>
    </div>
  );
}
