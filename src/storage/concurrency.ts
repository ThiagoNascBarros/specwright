/** Max files read at once per call; keeps far below common `ulimit -n` values (EMFILE). */
export const READ_CONCURRENCY = 32;

/** Like Promise.all(items.map(fn)) but with at most `limit` calls in flight; keeps order. */
export async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}
