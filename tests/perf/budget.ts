/** NFR-7 targets; shared runners get a 2x margin so the suite stays stable on CI. */
export const factor = process.env.CI ? 2 : 1;

export async function timed<T>(fn: () => Promise<T>): Promise<{ ms: number; value: T }> {
  const start = performance.now();
  const value = await fn();
  return { ms: performance.now() - start, value };
}

/** Median of `runs` executions after one warm-up call. */
export async function median(runs: number, fn: () => Promise<unknown>): Promise<number> {
  await fn();
  const samples: number[] = [];
  for (let i = 0; i < runs; i++) samples.push((await timed(fn)).ms);
  samples.sort((a, b) => a - b);
  return samples[Math.floor(samples.length / 2)];
}
