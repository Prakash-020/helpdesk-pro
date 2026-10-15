import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/server.ts'],
  format: 'esm',
  outDir: 'dist',
  clean: true,
  sourcemap: true,
  // @helpdesk/shared ships raw .ts (workspace contract package) — bundle it
  // into dist so the production node process never has to compile TS.
  noExternal: ['@helpdesk/shared'],
});
