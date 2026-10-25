#!/usr/bin/env node
import { StdioServerTransport } from '@modelcontextprotocol/server/stdio';
import { loadConfig } from './config.js';
import { runGraphCli } from './cli/graph.js';
import { createServer } from './server.js';

if (process.argv[2] === 'graph') {
  // CLI mode: stdout carries the command's JSON only.
  process.exitCode = await runGraphCli(process.argv.slice(3), process.env, process.cwd(), (text) => process.stdout.write(text));
} else {
  try {
    const server = createServer(loadConfig(process.env, process.cwd()));
    await server.connect(new StdioServerTransport());
  } catch (error) {
    // stdout carries JSON-RPC; diagnostics go to stderr only.
    console.error('specwright: failed to start:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}
