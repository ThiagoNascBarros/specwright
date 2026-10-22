import { describe, it, expect, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';

const testsDir = fileURLToPath(new URL('../', import.meta.url));
const entry = fileURLToPath(new URL('../../dist/index.js', import.meta.url));
const pkg = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8'));

// Every tool the finished server must expose; each spec adds its own.
export const EXPECTED_TOOLS = ['check_task_against_spec', 'get_spec', 'list_decisions', 'list_open_requirements', 'list_specs', 'log_decision', 'pack_context', 'save_memory', 'search_memory', 'set_criterion_status'];

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

  it('spec-reading AC-13 / context-pack AC-11: exposes exactly the 10 expected tools within the NFR-3 size budget', async () => {
    const { client } = await connect();
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual([...EXPECTED_TOOLS].sort());
    expect(JSON.stringify({ tools }).length).toBeLessThanOrEqual(12000);
    for (const t of tools) expect(t.description!.split(/(?<=\.)\s+/).length).toBeLessThanOrEqual(2);
  });

  it('answers a tool call over stdio (NOT_INITIALIZED when run outside a project)', async () => {
    const { client } = await connect();
    const r = await client.callTool({ name: 'list_specs', arguments: {} });
    expect(r.isError).toBe(true);
    expect((r.content as Array<{ text: string }>)[0].text).toContain('NOT_INITIALIZED');
  });

  it('exits after the client closes stdin', async () => {
    const { client, transport } = await connect();
    const pid = transport.pid!;
    await client.close();
    await new Promise((r) => setTimeout(r, 2000));
    expect(() => process.kill(pid, 0)).toThrow();
  });
});
