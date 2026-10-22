import type { DiffSummary, FileChange } from './types.js';

interface Draft {
  oldPath?: string;
  newPath?: string;
  renameFrom?: string;
  renameTo?: string;
  added: number;
  removed: number;
  hunks: number;
  binary: boolean;
  sawMinus: boolean;
  /** True when the file came with a `diff --git` header; only then do differing paths mean a rename. */
  git: boolean;
}

const HUNK = /^@@ -\d+(?:,(\d+))? \+\d+(?:,(\d+))? @@/;
const DEV_NULL = '/dev/null';

/** Strips the `a/`/`b/` prefix and a trailing tab + timestamp. */
function cleanPath(raw: string): string {
  const path = raw.split('\t')[0].trim();
  if (path === DEV_NULL) return path;
  return path.replace(/^[ab]\//, '');
}

function finish(d: Draft): FileChange {
  const oldPath = d.renameFrom ?? d.oldPath;
  const newPath = d.renameTo ?? d.newPath;
  let status: FileChange['status'] = 'modified';
  let path = newPath ?? oldPath ?? '';
  if (oldPath === DEV_NULL) status = 'added';
  else if (newPath === DEV_NULL) {
    status = 'deleted';
    path = oldPath ?? '';
  } else if (d.git && oldPath && newPath && oldPath !== newPath) status = 'renamed';
  const change: FileChange = {
    path,
    ...(status === 'renamed' ? { old_path: oldPath } : {}),
    status,
    added: d.added,
    removed: d.removed,
    hunks: d.hunks,
  };
  if (d.binary) change.binary = true;
  return change;
}

/**
 * Summarizes a unified diff (`git diff` or `diff -u`). Hunk bodies are consumed by the line
 * counts in their `@@` header, so content lines starting with `---`/`+++` are never headers.
 */
export function parseUnifiedDiff(text: string): DiffSummary {
  const files: FileChange[] = [];
  let current: Draft | undefined;
  let oldLeft = 0;
  let newLeft = 0;
  const start = (): Draft => ({ added: 0, removed: 0, hunks: 0, binary: false, sawMinus: false, git: false });
  const flush = () => {
    if (current && (current.oldPath || current.newPath || current.renameFrom)) files.push(finish(current));
    current = undefined;
  };

  for (const rawLine of text.split('\n')) {
    const line = rawLine.endsWith('\r') ? rawLine.slice(0, -1) : rawLine;
    if (oldLeft > 0 || newLeft > 0) {
      const marker = line[0];
      if (marker === '+') {
        current!.added++;
        newLeft--;
      } else if (marker === '-') {
        current!.removed++;
        oldLeft--;
      } else if (marker === ' ' || line === '') {
        oldLeft--;
        newLeft--;
      }
      // "\ No newline at end of file" consumes nothing.
      continue;
    }
    if (line.startsWith('diff --git ')) {
      flush();
      current = start();
      current.git = true;
      const m = /^diff --git a\/(.+) b\/(.+)$/.exec(line);
      if (m) {
        current.oldPath = m[1];
        current.newPath = m[2];
      }
    } else if (line.startsWith('--- ')) {
      if (!current || current.sawMinus) {
        flush();
        current = start();
      }
      current.sawMinus = true;
      current.oldPath = cleanPath(line.slice(4));
    } else if (line.startsWith('+++ ') && current) {
      current.newPath = cleanPath(line.slice(4));
    } else if (current && line.startsWith('rename from ')) {
      current.renameFrom = line.slice('rename from '.length);
    } else if (current && line.startsWith('rename to ')) {
      current.renameTo = line.slice('rename to '.length);
    } else if (current && (/^Binary files .* differ$/.test(line) || line === 'GIT binary patch')) {
      current.binary = true;
    } else if (current) {
      const h = HUNK.exec(line);
      if (h) {
        current.hunks++;
        oldLeft = h[1] === undefined ? 1 : Number(h[1]);
        newLeft = h[2] === undefined ? 1 : Number(h[2]);
      }
    }
  }
  flush();
  const totals = files.reduce((t, f) => ({ files: t.files + 1, added: t.added + f.added, removed: t.removed + f.removed }), {
    files: 0,
    added: 0,
    removed: 0,
  });
  return { files, totals };
}
