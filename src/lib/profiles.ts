export interface BlueskyProfile {
  did: string;
  handle: string;
  displayName: string;
  avatar: string;
}

const profileCache = new Map<string, BlueskyProfile>();

async function resolveProfile(did: string): Promise<BlueskyProfile> {
  const cached = profileCache.get(did);
  if (cached) return cached;

  try {
    const res = await fetch(
      `https://public.api.bsky.app/xrpc/app.bsky.actor.getProfile?actor=${encodeURIComponent(did)}`,
      { signal: AbortSignal.timeout(5000) }
    );
    if (res.ok) {
      const data = await res.json();
      const profile: BlueskyProfile = {
        did,
        handle: data.handle || did,
        displayName: data.displayName || data.handle || did,
        avatar: data.avatar || "",
      };
      profileCache.set(did, profile);
      return profile;
    }
  } catch {
    // Fall through to default
  }

  const fallback: BlueskyProfile = {
    did,
    handle: did.replace("did:plc:", "").slice(0, 12),
    displayName: "",
    avatar: "",
  };
  profileCache.set(did, fallback);
  return fallback;
}

export async function resolveProfiles(
  dids: string[]
): Promise<Map<string, BlueskyProfile>> {
  const unique = [...new Set(dids)];
  const results = new Map<string, BlueskyProfile>();

  // Resolve in parallel, batches of 10
  for (let i = 0; i < unique.length; i += 10) {
    const batch = unique.slice(i, i + 10);
    const profiles = await Promise.all(batch.map(resolveProfile));
    for (const p of profiles) {
      results.set(p.did, p);
    }
  }

  return results;
}
