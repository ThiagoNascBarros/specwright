import { mkdtemp, mkdir, writeFile, rm, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach } from 'vitest';
import { Client, InMemoryTransport } from '@modelcontextprotocol/client';
import { createServer } from '../src/server.js';
import type { Config } from '../src/config.js';

const cleanups: Array<() => Promise<void>> = [];

afterEach(async () => {
  while (cleanups.length) await cleanups.pop()!();
});

/** Creates a temporary project with `files` (paths relative to the project root) and returns its paths. */
export async function makeProject(files: Record<string, string> = {}) {
  const project = await realpath(await mkdtemp(join(tmpdir(), 'specwright-')));
  cleanups.push(() => rm(project, { recursive: true, force: true }));
  for (const [path, content] of Object.entries(files)) {
    const full = join(project, path);
    await mkdir(dirname(full), { recursive: true });
    await writeFile(full, content);
  }
  return { project, root: join(project, '.specwright') };
}

export function spec(id: string, body = '', front: Record<string, string> = {}) {
  const fm = { id, title: `Title of ${id}`, status: 'draft', ...front };
  const lines = Object.entries(fm).map(([k, v]) => `${k}: ${v}`);
  return `---\n${lines.join('\n')}\n---\n${body}`;
}

export interface ToolResponse {
  isError: boolean;
  data: any;
  text: string;
}

/** Connects an in-process client to a fresh server for `root`. */
export async function connect(root: string, overrides: Partial<Config> = {}, now?: () => Date) {
  const config: Config = { root, maxResponseChars: 20000, ...overrides };
  const server = createServer(config, now ? { now } : undefined);
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport as never);
  const client = new Client({ name: 'test', version: '0.0.0' });
  await client.connect(clientTransport);
  cleanups.push(async () => {
    await client.close();
    await server.close();
  });
  const call = async (name: string, args: Record<string, unknown> = {}): Promise<ToolResponse> => {
    const result = await client.callTool({ name, arguments: args });
    const text = (result.content as Array<{ type: string; text: string }>)[0]?.text ?? '';
    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
    return { isError: result.isError === true, data, text };
  };
  return { client, call };
}
