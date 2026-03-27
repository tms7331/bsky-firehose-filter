import { JetstreamSubscriber } from "@/lib/jetstream";
import { filterPosts } from "@/lib/ai-filter";
import { resolveProfiles } from "@/lib/profiles";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 minute max for streaming

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const prompt = searchParams.get("prompt");
  const matchesPerBatch = Math.min(
    parseInt(searchParams.get("matchesPerBatch") || "5", 10),
    20
  );
  const batchSize = Math.min(
    parseInt(searchParams.get("batchSize") || "100", 10),
    200
  );

  if (!prompt) {
    return new Response("Missing prompt parameter", { status: 400 });
  }

  if (!process.env.OPENROUTER_API_KEY) {
    return new Response("OPENROUTER_API_KEY not configured", { status: 500 });
  }

  const encoder = new TextEncoder();
  let closed = false;
  let subscriber: JetstreamSubscriber | null = null;
  let processing = false;

  const stream = new ReadableStream({
    start(controller) {
      // Send initial connection event
      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify({ type: "connected" })}\n\n`)
      );

      subscriber = new JetstreamSubscriber(batchSize, async (batch) => {
        // Skip if already processing a batch or stream is closed
        if (processing || closed) return;
        processing = true;

        try {
          const matches = await filterPosts(batch, prompt, matchesPerBatch);
          if (matches.length === 0 || closed) {
            processing = false;
            return;
          }

          // Resolve author profiles
          const dids = matches.map((m) => m.did);
          const profiles = await resolveProfiles(dids);

          for (const post of matches) {
            if (closed) break;
            const profile = profiles.get(post.did);
            const event = {
              post: {
                text: post.text,
                createdAt: post.createdAt,
                uri: `at://${post.did}/app.bsky.feed.post/${post.rkey}`,
                cid: post.cid,
              },
              author: {
                did: post.did,
                handle: profile?.handle || post.did,
                displayName: profile?.displayName || "",
                avatar: profile?.avatar || "",
              },
            };

            try {
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify(event)}\n\n`)
              );
            } catch {
              // Stream was closed
              closed = true;
              break;
            }
          }
        } catch (err) {
          console.error("[stream] filter error:", err);
          if (!closed) {
            try {
              controller.enqueue(
                encoder.encode(
                  `event: error\ndata: ${JSON.stringify({ message: "Filter error - retrying..." })}\n\n`
                )
              );
            } catch {
              closed = true;
            }
          }
        } finally {
          processing = false;
        }
      });

      subscriber.connect();

      // Clean up on client disconnect
      request.signal.addEventListener("abort", () => {
        closed = true;
        subscriber?.close();
        try {
          controller.close();
        } catch {
          // Already closed
        }
      });
    },
    cancel() {
      closed = true;
      subscriber?.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
