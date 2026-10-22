import { mkdir, rm, stat } from 'node:fs/promises';

export const STALE_LOCK_MS = 10_000;
const RETRY_MS = 5;
const TIMEOUT_MS = 10_000;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Runs `fn` while holding a lock shared by every process on this machine: `mkdir` is atomic,
 * so only one caller can create `lockPath`. A lock older than STALE_LOCK_MS is assumed to be
 * left by a crashed process and is broken.
 */
export async function withLock<T>(lockPath: string, fn: () => Promise<T>): Promise<T> {
  const deadline = Date.now() + TIMEOUT_MS;
  for (;;) {
    try {
      await mkdir(lockPath);
      break;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
      const age = await stat(lockPath).then((s) => Date.now() - s.mtimeMs, () => 0);
      if (age > STALE_LOCK_MS) await rm(lockPath, { recursive: true, force: true });
      else if (Date.now() > deadline) throw new Error(`Timed out waiting for lock ${lockPath}`);
      else await sleep(RETRY_MS + Math.random() * RETRY_MS);
    }
  }
  try {
    return await fn();
  } finally {
    await rm(lockPath, { recursive: true, force: true });
  }
}
