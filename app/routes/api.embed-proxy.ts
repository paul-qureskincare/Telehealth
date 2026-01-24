import type { Route } from "./+types/api.embed-proxy";
import { TTL_MS, getCached, setCached, isCacheValid } from "../utils/cache.server";

type LoadPayload = {
  embeddablesToLoad?: Array<{ id?: string }>;
};

const DEFAULT_ENGINE_DOMAIN = "engine.embeddables.com";

function sanitizeCacheKey(value: string) {
  // Replace unsafe characters to keep cache keys stable.
  return value.replace(/[^a-zA-Z0-9_-]/g, "_");
}

function tryExtractFlowId(loadParam: string | null): string | null {
  if (!loadParam) {
    return null;
  }

  try {
    const parsed = JSON.parse(loadParam) as LoadPayload;
    const first = parsed.embeddablesToLoad?.[0];
    return first?.id ?? null;
  } catch {
    return null;
  }
}

function buildExternalUrl(loadParam: string, engineDomain: string) {
  const urlRoot = engineDomain.startsWith("http") ? engineDomain : `https://${engineDomain}`;
  return `${urlRoot}/init?load=${encodeURIComponent(loadParam)}`;
}

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const loadParam = url.searchParams.get("load");
  const engineDomain = url.searchParams.get("engineDomain") || DEFAULT_ENGINE_DOMAIN;
  const flowId = url.searchParams.get("flowId") || tryExtractFlowId(loadParam);

  if (!flowId) {
    return Response.json({ error: "Missing flowId" }, { status: 400 });
  }

  // Generate cache key from flowId
  const safeFlowId = sanitizeCacheKey(flowId);
  const cacheKey = `embed_${safeFlowId}`;

  // Check if we have valid cached data
  if (isCacheValid(cacheKey)) {
    const cached = getCached(cacheKey);
    return Response.json({ ...cached, _cacheStatus: { fromCache: true, timestamp: Date.now() } });
  }

  if (!loadParam) {
    return Response.json({ error: "Missing load payload" }, { status: 400 });
  }

  // Fetch from external API
  const externalUrl = buildExternalUrl(loadParam, engineDomain);
  const response = await fetch(externalUrl);

  if (!response.ok) {
    return Response.json(
      { error: "Failed to fetch embed", status: response.status },
      { status: 502 }
    );
  }

  const data = await response.json();
  
  // Store in cache
  setCached(cacheKey, data, TTL_MS);
  
  return Response.json({ ...data, _cacheStatus: { fromCache: false, timestamp: Date.now() } });
}
