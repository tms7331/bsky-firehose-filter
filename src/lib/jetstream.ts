import WebSocket from "ws";

export interface PostImage {
  alt: string;
  thumb: string;
  aspectRatio?: { width: number; height: number };
}

export interface JetstreamPost {
  did: string;
  rkey: string;
  text: string;
  createdAt: string;
  langs?: string[];
  cid: string;
  images?: PostImage[];
}

export type BatchCallback = (batch: JetstreamPost[]) => void;

export class JetstreamSubscriber {
  private ws: WebSocket | null = null;
  private buffer: JetstreamPost[] = [];
  private batchSize: number;
  private onBatch: BatchCallback;
  private closed = false;

  constructor(batchSize: number, onBatch: BatchCallback) {
    this.batchSize = batchSize;
    this.onBatch = onBatch;
  }

  connect() {
    if (this.closed) return;

    const url =
      "wss://jetstream2.us-east.bsky.network/subscribe?wantedCollections=app.bsky.feed.post";
    this.ws = new WebSocket(url);

    this.ws.on("open", () => {
      console.log("[jetstream] connected");
    });

    this.ws.on("message", (data: Buffer) => {
      if (this.closed) return;
      try {
        const msg = JSON.parse(data.toString());
        if (
          msg.kind === "commit" &&
          msg.commit?.operation === "create" &&
          msg.commit?.collection === "app.bsky.feed.post"
        ) {
          const record = msg.commit.record;
          // Filter for English posts with text
          const langs: string[] | undefined = record.langs;
          if (langs && langs.includes("en") && record.text) {
            // Extract images from embeds
            const embed = record.embed;
            const imageEmbed =
              embed?.$type === "app.bsky.embed.images"
                ? embed
                : embed?.media?.$type === "app.bsky.embed.images"
                  ? embed.media
                  : null;

            const images: PostImage[] = [];
            if (imageEmbed?.images) {
              for (const img of imageEmbed.images) {
                const ref = img.image?.ref?.$link;
                if (ref) {
                  images.push({
                    alt: img.alt || "",
                    thumb: `https://cdn.bsky.app/img/feed_thumbnail/plain/${msg.did}/${ref}@jpeg`,
                    aspectRatio: img.aspectRatio,
                  });
                }
              }
            }

            this.buffer.push({
              did: msg.did,
              rkey: msg.commit.rkey,
              text: record.text,
              createdAt: record.createdAt,
              langs,
              cid: msg.commit.cid,
              ...(images.length > 0 && { images }),
            });

            if (this.buffer.length >= this.batchSize) {
              const batch = this.buffer.splice(0, this.batchSize);
              this.onBatch(batch);
            }
          }
        }
      } catch {
        // Skip malformed messages
      }
    });

    this.ws.on("error", (err: Error) => {
      console.error("[jetstream] error:", err.message);
    });

    this.ws.on("close", () => {
      console.log("[jetstream] disconnected");
      if (!this.closed) {
        setTimeout(() => this.connect(), 2000);
      }
    });
  }

  close() {
    this.closed = true;
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}
