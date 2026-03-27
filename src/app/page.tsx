"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Post, type FilteredPost } from "@/components/Post";

export default function Home() {
  const [prompt, setPrompt] = useState("");
  const [rate, setRate] = useState(10);
  const [isStreaming, setIsStreaming] = useState(false);
  const [posts, setPosts] = useState<FilteredPost[]>([]);
  const [status, setStatus] = useState("Enter a filter and press Start");
  const [bufferSize, setBufferSize] = useState(0);

  const bufferRef = useRef<FilteredPost[]>([]);
  const eventSourceRef = useRef<EventSource | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const newestPostIdRef = useRef<string | null>(null);

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

  // Restart drip timer when rate changes during streaming
  useEffect(() => {
    if (isStreaming) {
      startDrip(rate);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [rate, isStreaming, startDrip]);

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
          setStatus("Connected - scanning for matches...");
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
        setStatus("Reconnecting...");
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
      posts.length > 0 ? `Stopped - ${posts.length} posts shown` : "Stopped"
    );
  }, [posts.length]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      eventSourceRef.current?.close();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const rateLabel =
    rate >= 60 ? "1/sec" : rate === 1 ? "1/min" : `${rate}/min`;

  return (
    <div className="min-h-screen bg-[#f3f3f8] dark:bg-[#0d1117]">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/95 dark:bg-[#161b22]/95 backdrop-blur-sm border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-[600px] mx-auto px-4 py-3">
          <div className="flex items-center gap-2 mb-3">
            <svg
              className="w-6 h-6 text-[#0085ff]"
              viewBox="0 0 360 320"
              fill="currentColor"
            >
              <path d="M254.896 184.158C252.81 166.92 250.724 149.682 248.638 132.444C246.552 115.206 244.466 97.968 242.38 80.73C240.294 63.492 238.208 46.254 236.122 29.016C234.036 11.778 231.95 -5.46 229.864 -22.698L229.864 -22.698C229.35 -26.986 224.176 -29.148 220.884 -26.292L220.884 -26.292C209.124 -16.098 197.364 -5.904 185.604 4.29C173.844 14.484 162.084 24.678 150.324 34.872C138.564 45.066 126.804 55.26 115.044 65.454C103.284 75.648 91.524 85.842 79.764 96.036L79.764 96.036C78.162 97.422 78.162 99.918 79.764 101.304L79.764 101.304C91.524 111.498 103.284 121.692 115.044 131.886C126.804 142.08 138.564 152.274 150.324 162.468C162.084 172.662 173.844 182.856 185.604 193.05C197.364 203.244 209.124 213.438 220.884 223.632L220.884 223.632C224.176 226.488 229.35 224.326 229.864 220.038L229.864 220.038C231.95 202.8 234.036 185.562 236.122 168.324C238.208 151.086 240.294 133.848 242.38 116.61C244.466 99.372 246.552 82.134 248.638 64.896C250.724 47.658 252.81 30.42 254.896 13.182" />
            </svg>
            <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">
              Firehose Filter
            </h1>
            {isStreaming && (
              <span className="ml-auto flex items-center gap-1.5 text-xs text-green-600 dark:text-green-400">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                Live
              </span>
            )}
          </div>

          {/* Filter input */}
          <div className="flex gap-2 mb-2">
            <input
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !isStreaming) startStream();
              }}
              placeholder='e.g. "hot takes about AI" or "people looking for jobs"'
              className="flex-1 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-[#0d1117] text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0085ff] focus:border-transparent"
              disabled={isStreaming}
            />
            <button
              onClick={isStreaming ? stopStream : startStream}
              disabled={!prompt.trim() && !isStreaming}
              className={`px-5 py-2 rounded-lg text-sm font-semibold text-white transition-colors ${
                isStreaming
                  ? "bg-red-500 hover:bg-red-600"
                  : "bg-[#0085ff] hover:bg-[#0070dd] disabled:opacity-40 disabled:cursor-not-allowed"
              }`}
            >
              {isStreaming ? "Stop" : "Start"}
            </button>
          </div>

          {/* Rate slider */}
          <div className="flex items-center gap-3">
            <label className="text-xs text-gray-500 dark:text-gray-400 min-w-[4.5rem]">
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
              <span className="text-[11px] text-gray-400 dark:text-gray-500 tabular-nums whitespace-nowrap">
                {bufferSize} queued
              </span>
            )}
          </div>

          {/* Status */}
          <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1">
            {status}
          </p>
        </div>
      </header>

      {/* Feed */}
      <main className="max-w-[600px] mx-auto bg-white dark:bg-[#161b22] min-h-[calc(100vh-160px)] border-x border-gray-200 dark:border-gray-800">
        {posts.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 px-4 text-gray-400 dark:text-gray-500">
            {isStreaming ? (
              <>
                <div className="w-8 h-8 border-2 border-gray-300 dark:border-gray-600 border-t-[#0085ff] rounded-full animate-spin mb-4" />
                <p className="text-sm">Scanning the firehose for matches...</p>
                <p className="text-xs mt-1">
                  This may take a moment as posts are batched and filtered
                </p>
              </>
            ) : (
              <>
                <p className="text-sm mb-1">
                  Describe what you want to see from the Bluesky firehose
                </p>
                <p className="text-xs">
                  AI will filter live posts in real-time and stream matches here
                </p>
              </>
            )}
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
