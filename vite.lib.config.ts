import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const pkg = JSON.parse(readFileSync('./package.json', 'utf8')) as {
  dependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
};

const runtimeDeps = [
  ...Object.keys(pkg.dependencies ?? {}),
  ...Object.keys(pkg.peerDependencies ?? {}),
];

const escapeRe = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Everything the consumer already installs stays an import rather than being copied in —
 * react most of all, since two copies of it on one page is a broken app.
 *
 * Patterns rather than a predicate function, which does not work here: Vite's resolver
 * runs before rollup consults `external`, and it only knows to leave an import alone if
 * it can read the list. Given a function it resolves every bare specifier first, and the
 * whole of react-pdf ends up inside the bundle.
 *
 * Stylesheets are the exception, hence the lookahead. react-pdf's text layer CSS is not
 * optional, so folding it into the one emitted stylesheet leaves a consumer with a single
 * file to import and no way to end up with half of it.
 */
const external = [
  ...runtimeDeps,
  ...runtimeDeps.map((dep) => new RegExp(`^${escapeRe(dep)}/(?!.*\\.css$)`)),
];

export default defineConfig({
  plugins: [react()],
  // `public/` belongs to the demo — its samples and favicon are not part of the package.
  publicDir: false,
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: true,
    /*
      Library mode inlines every asset it finds by default, which for the pdfjs worker
      means a megabyte of base64 welded into the entry — paid for by every consumer,
      whether or not they ever open a document. Emitted as a file instead, what is left
      in the code is a plain new URL(...) against import.meta.url, which the consumer
      bundler resolves and copies the way it would any other asset reference.
    */
    assetsInlineLimit: 0,
    lib: {
      entry: resolve(import.meta.dirname, 'src/index.ts'),
      formats: ['es'],
      fileName: () => 'index.js',
      // Named so the documented `import 'peppol-viewer/styles.css'` keeps working
      // whatever the entry is called.
      cssFileName: 'styles',
    },
    rollupOptions: { external },
  },
});
