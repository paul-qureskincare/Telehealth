import fs from "fs/promises";
import path from "path";

export const CACHE_DIR = path.join(process.cwd(), ".cache");
export const TTL_MS = 15 * 60 * 1000; // 15 minutes

export async function ensureCacheDir() {
  await fs.mkdir(CACHE_DIR, { recursive: true });
}

export async function isCacheValid(filePath: string, ttl: number): Promise<boolean> {
  try {
    const stats = await fs.stat(filePath);
    const age = Date.now() - stats.mtimeMs;
    return age < ttl;
  } catch {
    return false;
  }
}
