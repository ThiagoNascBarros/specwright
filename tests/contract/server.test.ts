import { describe, it, expect, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';

const testsDir = fileURLToPath(new URL('../', import.meta.url));
const entry = fileURLToPath(new URL('../../dist/index.js', import.meta.url));
const pkg = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8'));

// Every tool the finished server must expose; each spec adds its own.
export const EXPECTED_TOOLS = ['check_against_spec', 'extraction_batch', 'find_path', 'get_artifact', 'get_node', 'graph_report', 'list_decisions', 'list_features', 'list_open_tasks', 'log_decision', 'pack_context', 'query_graph', 'save_memory', 'save_relations', 'search_memory', 'set_task_status'];

let client: Client | undefined;
afterEach(async () => {
  await client?.close();
  client = undefined;
});

async function connect() {
  // cwd outside the root: proves the server does not depend on the working directory
  const transport = new StdioClientTransport({ command: process.execPath, args: [entry], cwd: testsDir });
  client = new Client({ name: 'contract-test', version: '0.0.0' });
  await client.connect(transport);
  return { client, transport };
}

describe('stdio contract', () => {
  it('project-foundation AC-4: reports serverInfo name "specwright" and package.json version', async () => {
    const { client } = await connect();
    expect(client.getServerVersion()).toMatchObject({ name: 'specwright', version: pkg.version });
  });

  it('FR-013 / SC-004 / FR-025: exposes exactly the expected tools within the 16,000-character budget, 1,200 per tool', async () => {
    const { client } = await connect();
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual([...EXPECTED_TOOLS].sort());
    expect(JSON.stringify({ tools }).length).toBeLessThanOrEqual(16000);
    for (const t of tools) {
      expect(JSON.stringify(t).length).toBeLessThanOrEqual(1200);
      expect(t.description!.split(/(?<=\.)\s+/).length).toBeLessThanOrEqual(2);
    }
  });

  it('answers a tool call over stdio (no features outside a Spec Kit project)', async () => {
    const { client } = await connect();
    const r = await client.callTool({ name: 'list_features', arguments: {} });
    expect(r.isError).toBeFalsy();
    expect(JSON.parse((r.content as Array<{ text: string }>)[0].text)).toEqual({ features: [] });
  });

  it('exits after the client closes stdin', async () => {
    const { client, transport } = await connect();
    const pid = transport.pid!;
    await client.close();
    await new Promise((r) => setTimeout(r, 2000));
    expect(() => process.kill(pid, 0)).toThrow();
  });
});
