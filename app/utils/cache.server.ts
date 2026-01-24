import fs from "fs/promises";
import path from "path";

// Use /tmp on Vercel (Lambda environment), otherwise use .cache in current directory
const getCacheDir = () => {
  // Check if running in AWS Lambda/Vercel environment
  if (process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.VERCEL) {
    return path.join("/tmp", ".cache");
  }
  return path.join(process.cwd(), ".cache");
};

export const CACHE_DIR = getCacheDir();
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
