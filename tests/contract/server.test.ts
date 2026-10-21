import { describe, it, expect, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';

const testsDir = fileURLToPath(new URL('../', import.meta.url));
const entry = fileURLToPath(new URL('../../dist/index.js', import.meta.url));
const pkg = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8'));

let client: Client | undefined;
afterEach(async () => {
  await client?.close();
  client = undefined;
});

async function connect() {
  // cwd fora da raiz: prova que o servidor não depende do diretório de trabalho
  const transport = new StdioClientTransport({ command: process.execPath, args: [entry], cwd: testsDir });
  client = new Client({ name: 'contract-test', version: '0.0.0' });
  await client.connect(transport);
  return { client, transport };
}

describe('project-foundation contract', () => {
  it('AC-4: reports serverInfo name "specwright" and package.json version', async () => {
    const { client } = await connect();
    expect(client.getServerVersion()).toMatchObject({ name: 'specwright', version: pkg.version });
  });

  it('AC-5: exposes no tools capability', async () => {
    const { client } = await connect();
    expect(client.getServerCapabilities()?.tools).toBeUndefined();
  });

  it('exits after the client closes stdin', async () => {
    const { client, transport } = await connect();
    const pid = transport.pid!;
    await client.close();
    await new Promise((r) => setTimeout(r, 2000));
    expect(() => process.kill(pid, 0)).toThrow();
  });
});
