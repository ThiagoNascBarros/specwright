/** Options of each graph command: CLI flag → tool argument and how its value is read (plan.md "CLI"). */
type Kind = 'string' | 'number' | 'flag';
interface Spec { tool: string; positional: string[]; options: Record<string, [arg: string, kind: Kind]> }

const FEATURE: [string, Kind] = ['feature', 'string'];
const LIMIT: [string, Kind] = ['limit', 'number'];
const COMMANDS: Record<string, Spec> = {
  query: { tool: 'query_graph', positional: ['question...'], options: { '--feature': FEATURE, '--mode': ['mode', 'string'], '--depth': ['depth', 'number'], '--budget': ['budget_tokens', 'number'], '--include-ambiguous': ['include_ambiguous', 'flag'] } },
  node: { tool: 'get_node', positional: ['ref'], options: { '--feature': FEATURE, '--relation': ['relation', 'string'], '--limit': LIMIT } },
  path: { tool: 'find_path', positional: ['from', 'to'], options: { '--feature': FEATURE, '--max-hops': ['max_hops', 'number'], '--include-ambiguous': ['include_ambiguous', 'flag'] } },
  report: { tool: 'graph_report', positional: [], options: { '--top': ['top', 'number'], '--community': ['community', 'number'], '--offset': ['offset', 'number'], '--limit': LIMIT } },
  lint: { tool: 'lint_memory', positional: [], options: { '--feature': FEATURE, '--limit': LIMIT } },
  export: { tool: 'export_graph', positional: ['format'], options: {} },
};

const USAGE = 'usage: specwright-mcp graph <query <words…> | node <ref> | path <from> <to> | report | lint | export <json|report|obsidian>> [options]';

/** Parses the arguments after `graph`. Numbers are parsed here; the tool's zod schema validates them (plan.md "CLI"). */
export function parseGraphArgs(argv: string[]): { tool: string; args: Record<string, unknown> } | { usage: string } {
  const spec = COMMANDS[argv[0] ?? ''];
  if (!spec) return { usage: USAGE };
  const args: Record<string, unknown> = {};
  const positionals: string[] = [];
  for (let i = 1; i < argv.length; i++) {
    const token = argv[i];
    if (!token.startsWith('--')) { positionals.push(token); continue; }
    const option = spec.options[token];
    if (!option) return { usage: `${USAGE}\nunknown option ${token}` };
    const [name, kind] = option;
    if (kind === 'flag') { args[name] = true; continue; }
    const value = argv[++i];
    if (value === undefined) return { usage: `${USAGE}\n${token} needs a value` };
    args[name] = kind === 'number' ? Number(value) : value;
  }
  const required = spec.positional.filter((p) => !p.endsWith('...')).length;
  if (positionals.length < required) return { usage: `${USAGE}\n${argv[0]} needs ${spec.positional.join(' ')}` };
  if (argv[0] === 'query') {
    if (positionals.length === 0) return { usage: `${USAGE}\nquery needs words` };
    args.question = positionals.join(' ');
  } else if (argv[0] === 'export') {
    args.format = positionals[0];
  } else {
    spec.positional.forEach((name, i) => { args[name] = positionals[i]; });
  }
  return { tool: spec.tool, args };
}
