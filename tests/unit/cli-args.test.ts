import { describe, it, expect } from 'vitest';
import { parseGraphArgs } from '../../src/cli/args.js';

describe('parseGraphArgs', () => {
  it('FR-022: parses every command and option of the CLI table', () => {
    expect(parseGraphArgs(['query', 'album', 'sorting', '--feature', '001-photo-albums', '--mode', 'dfs', '--depth', '3', '--budget', '900', '--include-ambiguous'])).toEqual({
      tool: 'query_graph', args: { question: 'album sorting', feature: '001-photo-albums', mode: 'dfs', depth: 3, budget_tokens: 900, include_ambiguous: true },
    });
    expect(parseGraphArgs(['node', 'FR-002', '--relation', 'depends_on', '--limit', '5'])).toEqual({ tool: 'get_node', args: { ref: 'FR-002', relation: 'depends_on', limit: 5 } });
    expect(parseGraphArgs(['path', 'a', 'b', '--max-hops', '3', '--include-ambiguous'])).toEqual({ tool: 'find_path', args: { from: 'a', to: 'b', max_hops: 3, include_ambiguous: true } });
    expect(parseGraphArgs(['report', '--top', '5', '--community', '0', '--offset', '1', '--limit', '2'])).toEqual({ tool: 'graph_report', args: { top: 5, community: 0, offset: 1, limit: 2 } });
    expect(parseGraphArgs(['lint', '--feature', '001-photo-albums', '--limit', '3'])).toEqual({ tool: 'lint_memory', args: { feature: '001-photo-albums', limit: 3 } });
    expect(parseGraphArgs(['export', 'obsidian'])).toEqual({ tool: 'export_graph', args: { format: 'obsidian' } });
  });

  it('FR-022: an unknown option or a missing argument → usage', () => {
    for (const argv of [[], ['nope'], ['query', 'x', '--bogus'], ['node'], ['path', 'a'], ['export'], ['lint', '--budget', '3']]) {
      const result = parseGraphArgs(argv);
      expect('usage' in result && result.usage.length > 0).toBe(true);
    }
    expect('tool' in parseGraphArgs(['node', 'FR-002'])).toBe(true);
  });
});
