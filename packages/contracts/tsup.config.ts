import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  // d.ts is emitted by tsc: tsup's dts plugin needs the TS compiler API, which TS 7 lacks.
  dts: false,
  clean: true,
  sourcemap: true,
});
