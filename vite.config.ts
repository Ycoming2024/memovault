import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@types': path.resolve(__dirname, './src/types'),
      '@services': path.resolve(__dirname, './src/services'),
      '@core': path.resolve(__dirname, './src/core'),
    },
  },
  server: {
    port: 3000,
    open: true,
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor': ['react', 'react-dom'],
          'cytoscape': ['cytoscape'],
          'transformers': ['@xenova/transformers'],
          'orama': ['orama'],
        },
      },
    },
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'cytoscape', '@xenova/transformers', 'orama'],
  },
});
