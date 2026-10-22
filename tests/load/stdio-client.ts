import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';

const entry = fileURLToPath(new URL('../../dist/index.js', import.meta.url));

/** Starts the real built server as a child process on `root`, as an MCP client would. */
export async function startServer(root: string) {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [entry],
    env: { ...process.env, SPECWRIGHT_ROOT: root } as Record<string, string>,
    stderr: 'pipe',
  });
  const client = new Client({ name: 'load-test', version: '0.0.0' });
  await client.connect(transport);
  const call = async (name: string, args: Record<string, unknown> = {}) => {
    const r = await client.callTool({ name, arguments: args });
    const text = (r.content as Array<{ text: string }>)[0]?.text ?? '';
    return { isError: r.isError === true, data: JSON.parse(text) };
  };
  return { client, call, pid: transport.pid!, close: () => client.close() };
}

export function percentile(samples: number[], p: number): number {
  const sorted = [...samples].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];
}

export function report(name: string, samples: number[], wallMs: number) {
  const line = `[load] ${name}: n=${samples.length} p50=${percentile(samples, 50).toFixed(2)}ms p95=${percentile(samples, 95).toFixed(2)}ms p99=${percentile(samples, 99).toFixed(2)}ms max=${Math.max(...samples).toFixed(2)}ms throughput=${((samples.length / wallMs) * 1000).toFixed(0)} calls/s`;
  console.error(line);
  return line;
}
