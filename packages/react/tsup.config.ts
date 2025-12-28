import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    // Main entry point (includes everything)
    index: 'src/index.ts',
    // Modular entry points for tree-shaking
    'charts/index': 'src/charts/index.ts',
    'dashboard/index': 'src/dashboard/index.ts',
    'components/index': 'src/components/index.ts',
    'export/index': 'src/export/index.ts',
    'ssr/index': 'src/ssr/index.ts',
    'utils/index': 'src/utils/index.ts',
  },
  format: ['cjs', 'esm'],
  dts: true,
  splitting: true, // Enable code splitting for shared chunks
  sourcemap: true,
  clean: true,
  external: [
    'react',
    'react-dom',
    // Peer dependencies - consumers should install these
    'echarts',
    'echarts-for-react',
    'react-grid-layout',
    'xlsx',
  ],
  treeshake: true,
  minify: false, // Keep readable for debugging; consumers can minify
});
