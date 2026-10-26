// Bundles src/index.ts into one self-contained dist/index.js (no node_modules needed).
// The two modules that read package.json at runtime get the version inlined instead,
// so the bundle also works when copied away from the repository.
import { readFileSync } from 'node:fs';
import { build } from 'esbuild';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const readPkg = /JSON\.parse\(readFileSync\(new URL\('(?:\.\.\/)+package\.json', import\.meta\.url\), 'utf8'\)\) as \{ version: string \}/g;

const inlineVersion = {
  name: 'inline-package-version',
  setup(b) {
    b.onLoad({ filter: /[\\/]src[\\/](server|graph[\\/]repository)\.ts$/ }, (args) => {
      const source = readFileSync(args.path, 'utf8');
      const contents = source.replace(readPkg, `{ version: ${JSON.stringify(pkg.version)} } as { version: string }`);
      if (contents === source) throw new Error(`bundle: package.json read not found in ${args.path}`);
      return { contents, loader: 'ts' };
    });
  },
};

await build({
  entryPoints: ['src/index.ts'],
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'esm',
  outfile: 'dist/index.js',
  banner: { js: "import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);" },
  plugins: [inlineVersion],
  logLevel: 'info',
});
