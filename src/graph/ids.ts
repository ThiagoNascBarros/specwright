import { slugify } from '../storage/slug.js';
import { NODE_KINDS, type GraphNode, type NodeKind } from './types.js';

export const CONCEPT_ID = /^concept:[a-z0-9][a-z0-9-]{0,63}$/;

/** Typed node ids: `<kind>:<key>`, so every id parses back to its kind. */
export const nodeId = {
  feature: (f: string) => `feature:${f}`,
  artifact: (f: string, name: string) => `artifact:${f}/${name}`,
  constitution: () => 'artifact:constitution',
  requirement: (f: string, id: string) => `requirement:${f}/${id}`,
  criterion: (f: string, id: string) => `criterion:${f}/${id}`,
  story: (f: string, us: string) => `story:${f}/${us}`,
  task: (f: string, t: string) => `task:${f}/${t}`,
  principle: (key: string) => `principle:${key}`,
  decision: (n: string) => `decision:${n}`,
  note: (slug: string) => `note:${slug}`,
  doc: (path: string) => `doc:${path}`,
  file: (path: string) => `file:${path}`,
  concept: (slug: string) => `concept:${slug}`,
};

export function parseNodeId(id: string): { kind: NodeKind; key: string } | undefined {
  const at = id.indexOf(':');
  if (at < 0) return undefined;
  const kind = id.slice(0, at);
  const key = id.slice(at + 1);
  if (!(NODE_KINDS as readonly string[]).includes(kind) || key === '') return undefined;
  return { kind: kind as NodeKind, key };
}

export function scopeOfNode(node: Pick<GraphNode, 'feature'>): string {
  return node.feature ?? 'project';
}

export function conceptIdFor(label: string): string {
  return `concept:${slugify(label, 64) || 'concept'}`;
}
