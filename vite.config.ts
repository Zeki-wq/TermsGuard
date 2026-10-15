import { defineConfig, build as viteBuild } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { copyFileSync, mkdirSync, existsSync } from 'fs';

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'build-content-script-and-manifest',
      async closeBundle() {
        if (!existsSync('dist')) {
          mkdirSync('dist', { recursive: true });
        }

        // Build content script as pure standalone IIFE (Chrome MV3 content scripts cannot use ES module imports)
        await viteBuild({
          configFile: false,
          build: {
            emptyOutDir: false,
            outDir: 'dist',
            lib: {
              entry: resolve(__dirname, 'src/content/index.ts'),
              name: 'TermsGuardContentScript',
              formats: ['iife'],
              fileName: () => 'content.js',
            },
          },
        });

        // Copy manifest and extension icons to dist root
        copyFileSync('manifest.json', 'dist/manifest.json');
        if (existsSync('src/assets/icon128.png')) {
          if (!existsSync('dist/assets')) mkdirSync('dist/assets', { recursive: true });
          copyFileSync('src/assets/icon128.png', 'dist/assets/icon128.png');
          copyFileSync('src/assets/icon48.png', 'dist/assets/icon48.png');
          copyFileSync('src/assets/icon16.png', 'dist/assets/icon16.png');
        }
      },
    },
  ],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        popup: resolve(__dirname, 'src/popup/index.html'),
        options: resolve(__dirname, 'src/options/index.html'),
        background: resolve(__dirname, 'src/background/index.ts'),
      },
      output: {
        entryFileNames: (chunkInfo) => {
          if (chunkInfo.name === 'background') {
            return '[name].js';
          }
          return 'assets/[name]-[hash].js';
        },
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
      },
    },
  },
});
