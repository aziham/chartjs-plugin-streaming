import { resolve } from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  },
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'ChartStreaming',
      fileName: (format) => {
        if (format === 'es') return 'chartjs-plugin-streaming.esm.js';
        if (format === 'umd') return 'chartjs-plugin-streaming.js';
        return `chartjs-plugin-streaming.${format}.js`;
      },
      formats: ['es', 'umd']
    },
    rollupOptions: {
      external: ['chart.js', 'chart.js/helpers'],
      output: {
        globals: {
          'chart.js': 'Chart',
          'chart.js/helpers': 'Chart.helpers'
        },
        exports: 'named'
      }
    },
    sourcemap: true,
    emptyOutDir: true
  }
});
