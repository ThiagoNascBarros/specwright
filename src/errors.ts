export type ErrorCode =
  | 'NOT_INITIALIZED'
  | 'FEATURE_NOT_FOUND'
  | 'ARTIFACT_NOT_FOUND'
  | 'SECTION_NOT_FOUND'
  | 'TASK_NOT_FOUND'
  | 'INVALID_FEATURE'
  | 'INVALID_DIFF'
  | 'INVALID_INPUT'
  | 'PATH_OUTSIDE_ROOT'
  | 'INTERNAL';

export class SpecwrightError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly hint?: string,
  ) {
    super(message);
    this.name = 'SpecwrightError';
  }
}

export interface ToolResult {
  [key: string]: unknown;
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
}

const text = (value: unknown): ToolResult['content'] => [{ type: 'text', text: JSON.stringify(value) }];

/**
 * Serializes `data` and keeps it under `max` characters: a long `content` string is cut,
 * otherwise the first array field loses items from the end. Either way `truncated: true` is set.
 */
export function respond(data: Record<string, unknown>, max: number): ToolResult {
  if (JSON.stringify(data).length <= max) return { content: text(data) };
  const out: Record<string, unknown> = { ...data, truncated: true };
  if (typeof out.content === 'string') {
    out.content = out.content.slice(0, max);
    return { content: text(out) };
  }
  const key = Object.keys(out).find((k) => Array.isArray(out[k]));
  if (key) {
    // Linear: measure the envelope once, then add items while their serialized size fits.
    const items = out[key] as unknown[];
    let size = JSON.stringify({ ...out, [key]: [] }).length;
    let count = 0;
    for (const item of items) {
      const extra = JSON.stringify(item).length + (count > 0 ? 1 : 0);
      if (size + extra > max) break;
      size += extra;
      count++;
    }
    out[key] = items.slice(0, count);
  }
  return { content: text(out) };
}

export function errorResult(error: unknown): ToolResult {
  if (error instanceof SpecwrightError) {
    const body: Record<string, string> = { code: error.code, message: error.message };
    if (error.hint) body.hint = error.hint;
    return { content: text(body), isError: true };
  }
  // Unknown failures may carry absolute paths in their message; never echo it to the client.
  console.error('specwright: internal error', error);
  return { content: text({ code: 'INTERNAL', message: 'Unexpected internal error; see server stderr.' }), isError: true };
}

/** Wraps a tool body: success goes through `respond`, any throw becomes a structured error. */
export function tool<A>(max: number, body: (args: A) => Promise<Record<string, unknown>>) {
  return async (args: A): Promise<ToolResult> => {
    try {
      return respond(await body(args), max);
    } catch (error) {
      return errorResult(error);
    }
  };
}
