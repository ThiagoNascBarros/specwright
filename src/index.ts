#!/usr/bin/env node
import { StdioServerTransport } from '@modelcontextprotocol/server/stdio';
import { loadConfig } from './config.js';
import { createServer } from './server.js';

try {
  const server = createServer(loadConfig(process.env, process.cwd()));
  await server.connect(new StdioServerTransport());
} catch (error) {
  // stdout carries JSON-RPC; diagnostics go to stderr only.
  console.error('specwright: failed to start:', error instanceof Error ? error.message : error);
  process.exit(1);
}
