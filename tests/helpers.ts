import { cp, mkdtemp, mkdir, writeFile, rm, realpath } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach } from 'vitest';
import { Client, InMemoryTransport } from '@modelcontextprotocol/client';
import { createServer } from '../src/server.js';
import { DEFAULT_GRAPH_CONFIG, type Config } from '../src/config.js';

const cleanups: Array<() => Promise<void>> = [];

afterEach(async () => {
  while (cleanups.length) await cleanups.pop()!();
});

/** Creates a temporary project with `files` (paths relative to the project root). `root` is the project root. */
export async function makeProject(files: Record<string, string> = {}) {
  const project = await realpath(await mkdtemp(join(tmpdir(), 'specwright-')));
  cleanups.push(() => rm(project, { recursive: true, force: true }));
  for (const [path, content] of Object.entries(files)) {
    const full = join(project, path);
    await mkdir(dirname(full), { recursive: true });
    await writeFile(full, content);
  }
  return { project, root: project };
}

/** Copies `tests/fixtures/<name>/` into a temporary project and returns its root. */
export async function copyFixture(name: string) {
  const p = await makeProject();
  await cp(fileURLToPath(new URL(`./fixtures/${name}/`, import.meta.url)), p.root, { recursive: true });
  return p;
}

/** A minimal `spec.md` in Spec Kit's template shape. */
export function specMd(title: string, body = '', status = 'Draft') {
  return `# Feature Specification: ${title}\n\n**Feature Branch**: \`branch\`\n\n**Created**: 2026-10-21\n\n**Status**: ${status}\n\n**Input**: User description: "x"\n\n${body}`;
}

/** A minimal `tasks.md` with one phase and the given task lines. */
export function tasksMd(lines: string[], phase = 'Phase 1: Setup (Shared Infrastructure)') {
  return `# Tasks: x\n\n## ${phase}\n\n${lines.join('\n')}\n`;
}

export interface ToolResponse {
  isError: boolean;
  data: any;
  text: string;
}

/** Connects an in-process client to a fresh server for `root`. */
export async function connect(root: string, overrides: Partial<Config> = {}, now?: () => Date) {
  const config: Config = { root, maxResponseChars: 20000, graph: DEFAULT_GRAPH_CONFIG, ...overrides };
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
