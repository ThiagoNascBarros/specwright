import { describe, it, expect, afterEach } from 'vitest';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import { copyFixture } from '../helpers.js';
import { startServer } from '../load/stdio-client.js';

const entry = fileURLToPath(new URL('../../dist/index.js', import.meta.url));

const clients: Client[] = [];
afterEach(async () => {
  await Promise.all(clients.splice(0).map((c) => c.close()));
});

/** A second, raw view of a server process: the text of each response, unparsed. */
async function rawServer(root: string) {
  const transport = new StdioClientTransport({ command: process.execPath, args: [entry], env: { ...process.env, SPECWRIGHT_ROOT: root } as Record<string, string>, stderr: 'pipe' });
  const client = new Client({ name: 'workflow-test', version: '0.0.0' });
  await client.connect(transport);
  clients.push(client);
  return async (name: string, args: Record<string, unknown> = {}) => {
    const r = await client.callTool({ name, arguments: args });
    return (r.content as Array<{ text: string }>)[0]?.text ?? '';
  };
}

describe('SC-004: graph workflow over stdio', () => {
  it('SC-004: query_graph → extraction_batch plan → fetch → save_relations → the INFERRED edge shows, also in a second process; graph_report and lint_memory succeed', async () => {
    const { root } = await copyFixture('brain');
    const a = await startServer(root);
    try {
      expect((await a.call('query_graph', { question: 'album sorting' })).isError).toBe(false);

      const plan = await a.call('extraction_batch', {});
      expect(plan.isError).toBe(false);
      const batch = plan.data.batches[0];
      expect(batch.units.length).toBeGreaterThan(0);

      const fetched = await a.call('extraction_batch', { units: batch.units });
      expect(fetched.isError).toBe(false);
      const source = fetched.data.items[0].node as string;
      const target = (fetched.data.candidates as Array<[string, string]>).map(([id]) => id).find((id) => id !== source)!;
      expect(target).toBeDefined();

      const saved = await a.call('save_relations', {
        relations: [{ source, relation: 'related_to', target, confidence: 'INFERRED', score: 0.8, evidence: 'workflow test' }],
        covered: fetched.data.items.map((i: { unit: string; hash: string }) => ({ unit: i.unit, hash: i.hash })),
      });
      expect(saved.isError).toBe(false);
      expect(saved.data.rejected).toEqual([]);

      const shown = await a.call('get_node', { ref: source });
      expect(shown.data.out).toContainEqual(['related_to', target, expect.any(String), 'INFERRED', 0.8]);

      expect((await a.call('graph_report', {})).isError).toBe(false);
      expect((await a.call('lint_memory', {})).isError).toBe(false);

      const b = await startServer(root);
      try {
        const second = await b.call('get_node', { ref: source });
        expect(second.data.out).toContainEqual(['related_to', target, expect.any(String), 'INFERRED', 0.8]);
      } finally {
        await b.close();
      }
    } finally {
      await a.close();
    }
  }, 60_000);

  it('FR-026: query_graph, get_node, find_path, graph_report and lint_memory give byte-identical text in two processes', async () => {
    const { root } = await copyFixture('brain');
    const calls: Array<[string, Record<string, unknown>]> = [
      ['query_graph', { question: 'album sorting' }],
      ['get_node', { ref: 'decision:0002' }],
      ['find_path', { from: 'decision:0001', to: 'decision:0002' }],
      ['graph_report', {}],
      ['lint_memory', {}],
    ];
    const first = await rawServer(root);
    const second = await rawServer(root);
    for (const [name, args] of calls) {
      const x = await first(name, args);
      const y = await second(name, args);
      expect(x.length, name).toBeGreaterThan(0);
      expect(y, name).toBe(x);
    }
  }, 60_000);
});
