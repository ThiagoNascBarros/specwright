import { describe, it, expect } from 'vitest';
import { mkdir, stat, utimes } from 'node:fs/promises';
import { join } from 'node:path';
import { withLock } from '../../src/storage/lock.js';
import { makeProject } from '../helpers.js';

describe('cross-process lock', () => {
  it('runs critical sections one at a time and releases the lock', async () => {
    const { project } = await makeProject();
    const lock = join(project, '.lock');
    let active = 0;
    let maxActive = 0;
    await Promise.all(
      Array.from({ length: 20 }, () =>
        withLock(lock, async () => {
          active++;
          maxActive = Math.max(maxActive, active);
          await new Promise((r) => setTimeout(r, 2));
          active--;
        }),
      ),
    );
    expect(maxActive).toBe(1);
    await expect(stat(lock)).rejects.toThrow();
  });

  it('releases the lock when the critical section throws', async () => {
    const { project } = await makeProject();
    const lock = join(project, '.lock');
    await expect(withLock(lock, async () => Promise.reject(new Error('boom')))).rejects.toThrow('boom');
    await expect(stat(lock)).rejects.toThrow();
  });

  it('breaks a stale lock left by a crashed process', async () => {
    const { project } = await makeProject();
    const lock = join(project, '.lock');
    await mkdir(lock);
    const old = new Date(Date.now() - 60_000);
    await utimes(lock, old, old);
    expect(await withLock(lock, async () => 'ran')).toBe('ran');
  });
});
