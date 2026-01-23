import fs from "fs/promises";
import path from "path";
import type { Route } from "./+types/api.embed-proxy";
import { CACHE_DIR, TTL_MS, ensureCacheDir, isCacheValid } from "../utils/cache.server";

type LoadPayload = {
  embeddablesToLoad?: Array<{ id?: string }>;
};

const DEFAULT_ENGINE_DOMAIN = "engine.embeddables.com";

function sanitizeCacheKey(value: string) {
  // Replace unsafe characters to keep filesystem paths stable.
  return value.replace(/[^a-zA-Z0-9_-]/g, "_");
}

function formatDateForCache(): string {
  // Format: yyyy-mm-dd-HH to avoid special characters in filenames
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const date = String(now.getDate()).padStart(2, "0");
  const hours = String(now.getHours()).padStart(2, "0");
  
  return `${year}-${month}-${date}-${hours}`;
}

function buildExternalUrl(loadParam: string, engineDomain: string) {
  const urlRoot = engineDomain.startsWith("http") ? engineDomain : `https://${engineDomain}`;
  return `${urlRoot}/init?load=${encodeURIComponent(loadParam)}`;
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

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const loadParam = url.searchParams.get("load");
  const engineDomain = url.searchParams.get("engineDomain") || DEFAULT_ENGINE_DOMAIN;
  const flowId = url.searchParams.get("flowId") || tryExtractFlowId(loadParam);

  if (!flowId) {
    return Response.json({ error: "Missing flowId" }, { status: 400 });
  }

  await ensureCacheDir();
  const safeFlowId = sanitizeCacheKey(flowId);
  const datePrefix = formatDateForCache();
  const cacheFile = path.join(CACHE_DIR, `${datePrefix}_${safeFlowId}.json`);
  const cacheValid = await isCacheValid(cacheFile, TTL_MS);

  if (cacheValid) {
    const cached = await fs.readFile(cacheFile, "utf-8");
    const data = JSON.parse(cached);
    return Response.json({ ...data, _cacheStatus: { fromCache: true, timestamp: Date.now() } });
  }

  if (!loadParam) {
    return Response.json({ error: "Missing load payload" }, { status: 400 });
  }

  const externalUrl = buildExternalUrl(loadParam, engineDomain);
  const response = await fetch(externalUrl);

  if (!response.ok) {
    return Response.json(
      { error: "Failed to fetch embed", status: response.status },
      { status: 502 }
    );
  }

  const data = await response.json();
  await fs.writeFile(cacheFile, JSON.stringify(data), "utf-8");
  return Response.json({ ...data, _cacheStatus: { fromCache: false, timestamp: Date.now() } });
}
