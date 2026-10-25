import { ITEM_ID_SOURCE, QUALIFIED_ID } from '../storage/text.js';
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

const DECISION_REF = /^\d{4}$/;
const SLUG_REF = /^[a-z0-9-]+$/;
const BARE_REF = new RegExp(`^${ITEM_ID_SOURCE}$`, 'u');

function itemId(feature: string, item: string): string {
  if (item.startsWith('FR')) return nodeId.requirement(feature, item);
  if (item.startsWith('SC')) return nodeId.criterion(feature, item);
  if (item.startsWith('US')) return nodeId.story(feature, item);
  return nodeId.task(feature, item);
}

/**
 * Ids a reference can name without labels, most specific first: `<feature>/<item>`, a bare item with
 * `feature`, `NNNN` (decision), then a slug (note, then feature). Pure: the caller checks existence.
 */
export function refIdCandidates(ref: string, feature?: string): string[] {
  if (QUALIFIED_ID.test(ref)) {
    const slash = ref.lastIndexOf('/');  // feature ids contain no '/'
    return [itemId(ref.slice(0, slash), ref.slice(slash + 1))];
  }
  if (feature !== undefined && BARE_REF.test(ref)) return [itemId(feature, ref)];
  if (DECISION_REF.test(ref)) return [nodeId.decision(ref)];
  if (SLUG_REF.test(ref)) return [nodeId.note(ref), nodeId.feature(ref)];
  return [];
}
