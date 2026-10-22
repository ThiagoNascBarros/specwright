import { describe, it, expect, afterEach } from 'vitest';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { copyFixture } from '../helpers.js';
import { startServer } from '../load/stdio-client.js';

const diff = `diff --git a/src/models/photo.py b/src/models/photo.py
new file mode 100644
--- /dev/null
+++ b/src/models/photo.py
@@ -0,0 +1,1 @@
+class Photo: ...
`;

let close: (() => Promise<void>) | undefined;
afterEach(async () => {
  await close?.();
  close = undefined;
});

describe('end-to-end agent session on a Spec Kit project over stdio (all 10 tools)', () => {
  it('runs list → read → check → mark → decide → remember, then a new session recovers it', async () => {
    const { root } = await copyFixture('speckit');
    const first = await startServer(root);
    close = first.close;
    const { call } = first;

    // 1. Discover what to work on.
    const features = (await call('list_features')).data.features;
    expect(features.map((f: { id: string }) => f.id)).toEqual(['001-photo-albums', '002-sharing']);
    const open = (await call('list_open_tasks', { feature: '001-photo-albums', story: 'US1' })).data.open;
    expect(open.map((t: { id: string }) => t.id)).toEqual(['T005', 'T006', 'T007', 'T008']);

    // 2. Read only what is needed.
    const section = (await call('get_artifact', { feature: '001-photo-albums', artifact: 'spec', section: 'Requirements' })).data;
    expect(section.content).toContain('FR-001');

    // 3. Validate before saying "done".
    const check = (await call('check_against_spec', { feature: '001-photo-albums', diff })).data;
    expect(check.diff_summary.totals).toEqual({ files: 1, added: 1, removed: 0 });
    expect(check.open_clarifications).toEqual(['size limit not specified']);

    // 4. Record progress, the decision and what was learned.
    expect((await call('set_task_status', { feature: '001-photo-albums', task_id: 'T007', done: true })).data).toMatchObject({ changed: true, tasks: { done: 3, total: 11 } });
    expect(await readFile(join(root, 'specs/001-photo-albums/tasks.md'), 'utf8')).toContain('- [X] T007');
    expect((await call('log_decision', { feature: '001-photo-albums', title: 'Photo ids are UUIDs', decision: 'Use UUIDv7.', rationale: 'Sortable.' })).data.id).toBe('0001');
    expect((await call('save_memory', { type: 'pitfall', title: 'EXIF dates may be missing', body: 'Fall back to the file mtime in `src/models/photo.py`.' })).data.id).toBe('exif-dates-may-be-missing');

    // 5. A later session recovers history and a minimal context.
    const later = await startServer(root);
    const closeFirst = close;
    close = async () => {
      await closeFirst();
      await later.close();
    };
    expect((await later.call('list_open_tasks', { feature: '001-photo-albums', story: 'US1' })).data.open.map((t: { id: string }) => t.id)).toEqual(['T005', 'T006', 'T008']);
    expect((await later.call('list_decisions', { feature: '001-photo-albums' })).data.decisions).toHaveLength(1);
    const found = (await later.call('search_memory', { query: 'photo exif uuid' })).data.results.map((r: { kind: string }) => r.kind).sort();
    expect(found).toEqual(['decision', 'memory']);
    expect((await later.call('get_artifact', { artifact: 'constitution', section: 'Core Principles' })).data.content).toContain('Library-First');
    const ctx = (await later.call('pack_context', { task: 'photo model exif dates', feature: '001-photo-albums', budget_tokens: 1000 })).data;
    expect(ctx.used_tokens).toBeLessThanOrEqual(1000);
    expect(ctx.files).toContain('src/models/photo.py');
  });
});
