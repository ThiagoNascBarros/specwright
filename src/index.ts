#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { McpServer } from '@modelcontextprotocol/server';
import { StdioServerTransport } from '@modelcontextprotocol/server/stdio';

// Relative to this module, not cwd: the client may launch us from anywhere.
const { version } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

const server = new McpServer({ name: 'specwright', version });

try {
  await server.connect(new StdioServerTransport());
} catch (error) {
  // stdout carries JSON-RPC; diagnostics go to stderr only.
  console.error('specwright: failed to start', error);
  process.exit(1);
}
