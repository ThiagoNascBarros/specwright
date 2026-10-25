import { describe, it, expect, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';

const testsDir = fileURLToPath(new URL('../', import.meta.url));
const entry = fileURLToPath(new URL('../../dist/index.js', import.meta.url));
const pkg = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8'));

// Every tool the finished server must expose; each spec adds its own.
export const EXPECTED_TOOLS = ['check_against_spec', 'export_graph', 'extraction_batch', 'find_path', 'get_artifact', 'get_node', 'graph_report', 'list_decisions', 'list_features', 'list_open_tasks', 'lint_memory', 'log_decision', 'pack_context', 'query_graph', 'save_memory', 'save_relations', 'search_memory', 'set_task_status'];

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

const READ_TOOLS = ['check_against_spec', 'extraction_batch', 'find_path', 'get_artifact', 'get_node', 'graph_report', 'lint_memory', 'list_decisions', 'list_features', 'list_open_tasks', 'pack_context', 'query_graph', 'search_memory'];
const WRITE_TOOLS = ['export_graph', 'log_decision', 'save_memory', 'save_relations', 'set_task_status'];

describe('stdio contract: instructions and annotations', () => {
  it('US8-AS1 / FR-023: the initialize result instructions are at most 1,200 characters and name query_graph, get_node and extraction_batch', async () => {
    const { client } = await connect();
    const instructions = client.getInstructions() ?? '';
    expect(instructions.length).toBeGreaterThan(0);
    expect(instructions.length).toBeLessThanOrEqual(1200);
    for (const name of ['query_graph', 'get_node', 'extraction_batch']) expect(instructions).toContain(name);
  });

  it('FR-029: every tool has openWorldHint false; read tools readOnlyHint true; write tools destructiveHint false', async () => {
    const { client } = await connect();
    const { tools } = await client.listTools();
    expect(tools.length).toBe(18);
    for (const t of tools) expect(t.annotations?.openWorldHint, t.name).toBe(false);
    for (const name of READ_TOOLS) expect(tools.find((t) => t.name === name)?.annotations?.readOnlyHint, name).toBe(true);
    for (const name of WRITE_TOOLS) expect(tools.find((t) => t.name === name)?.annotations?.destructiveHint, name).toBe(false);
    expect(tools.find((t) => t.name === 'save_relations')?.annotations?.idempotentHint).toBe(true);
    expect(tools.find((t) => t.name === 'export_graph')?.annotations?.idempotentHint).toBe(true);
  });

  it('FR-025 / SC-005: each tool description has at most 2 sentences', async () => {
    const { client } = await connect();
    const { tools } = await client.listTools();
    for (const t of tools) {
      const sentences = (t.description ?? '').split(/(?<=[.!?])\s+/).filter((x) => x.trim().length > 0);
      expect(sentences.length, t.name).toBeLessThanOrEqual(2);
    }
  });
});

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
