import { describe, it, expect } from 'vitest';
import { parseUnifiedDiff } from '../../src/features/diff.js';

const modified = `diff --git a/src/auth.ts b/src/auth.ts
index 1111111..2222222 100644
--- a/src/auth.ts
+++ b/src/auth.ts
@@ -1,3 +1,4 @@
 import x from 'y';
-const a = 1;
+const a = 2;
+const b = 3;
 export {};
@@ -10,2 +11,2 @@ function f() {
-  return a;
+  return b;
 }
`;

describe('check-task: diff parser', () => {
  it('AC-1: counts added, removed and hunks for a modified file, and sums totals', () => {
    const summary = parseUnifiedDiff(modified + modified.replace(/auth\.ts/g, 'other.ts'));
    expect(summary.files[0]).toEqual({ path: 'src/auth.ts', status: 'modified', added: 3, removed: 2, hunks: 2 });
    expect(summary.totals).toEqual({ files: 2, added: 6, removed: 4 });
  });

  it('AC-2: new and deleted files', () => {
    const diff = `diff --git a/new.ts b/new.ts
new file mode 100644
--- /dev/null
+++ b/new.ts
@@ -0,0 +1,2 @@
+a
+b
diff --git a/old.ts b/old.ts
deleted file mode 100644
--- a/old.ts
+++ /dev/null
@@ -1 +0,0 @@
-gone
`;
    expect(parseUnifiedDiff(diff).files).toEqual([
      { path: 'new.ts', status: 'added', added: 2, removed: 0, hunks: 1 },
      { path: 'old.ts', status: 'deleted', added: 0, removed: 1, hunks: 1 },
    ]);
  });

  it('AC-3: renames', () => {
    const diff = `diff --git a/a.ts b/b.ts
similarity index 90%
rename from a.ts
rename to b.ts
--- a/a.ts
+++ b/b.ts
@@ -1 +1 @@
-x
+y
`;
    expect(parseUnifiedDiff(diff).files[0]).toEqual({ path: 'b.ts', old_path: 'a.ts', status: 'renamed', added: 1, removed: 1, hunks: 1 });
  });

  it('AC-3: pure rename without content changes', () => {
    const diff = `diff --git a/a.ts b/b.ts\nsimilarity index 100%\nrename from a.ts\nrename to b.ts\n`;
    expect(parseUnifiedDiff(diff).files[0]).toMatchObject({ path: 'b.ts', old_path: 'a.ts', status: 'renamed', hunks: 0 });
  });

  it('AC-4: binary files', () => {
    const diff = `diff --git a/logo.png b/logo.png\nindex 1..2 100644\nBinary files a/logo.png and b/logo.png differ\n`;
    expect(parseUnifiedDiff(diff).files[0]).toEqual({ path: 'logo.png', status: 'modified', added: 0, removed: 0, hunks: 0, binary: true });
  });

  it('AC-5: --- and +++ inside a hunk are content, not headers', () => {
    const diff = `--- a/notes.md
+++ b/notes.md
@@ -1,2 +1,2 @@
---- not a header
++++ not a header
 keep
`;
    const s = parseUnifiedDiff(diff);
    expect(s.files).toEqual([{ path: 'notes.md', status: 'modified', added: 1, removed: 1, hunks: 1 }]);
  });

  it('AC-6: plain diff -u with timestamps', () => {
    const diff = `--- old/file.txt\t2026-10-21 10:00:00.000000000 -0300
+++ new/file.txt\t2026-10-21 10:05:00.000000000 -0300
@@ -1 +1,2 @@
 a
+b
`;
    expect(parseUnifiedDiff(diff).files[0]).toEqual({ path: 'new/file.txt', status: 'modified', added: 1, removed: 0, hunks: 1 });
  });

  it('handles CRLF diffs and "No newline at end of file" markers', () => {
    const diff = '--- a/x\r\n+++ b/x\r\n@@ -1 +1 @@\r\n-a\r\n\\ No newline at end of file\r\n+b\r\n\\ No newline at end of file\r\n';
    expect(parseUnifiedDiff(diff).files[0]).toMatchObject({ path: 'x', added: 1, removed: 1 });
  });

  it('AC-8: returns no files for text without headers', () => {
    expect(parseUnifiedDiff('hello\nworld\n').files).toEqual([]);
    expect(parseUnifiedDiff('').files).toEqual([]);
  });
});
