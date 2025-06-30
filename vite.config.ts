import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig(({ mode }) => {
  const isVSCode = mode === 'vscode';

  return {
    plugins: [react()],
    root: 'src/client',
    publicDir: '../../public',
    base: isVSCode ? './' : '/',
    build: {
      outDir: isVSCode ? '../../vscode-extension/out/webview' : '../../dist/client',
      emptyOutDir: true,
      rollupOptions: isVSCode
        ? {
            output: {
              entryFileNames: 'main.js',
              chunkFileNames: '[name].js',
              assetFileNames: '[name].[ext]',
            },
          }
        : undefined,
    },
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src'),
        '@/types': resolve(__dirname, 'src/types'),
      },
    },
    css: {
      postcss: './postcss.config.js',
    },
    server: {
      port: 5173,
      proxy: {
        '/api': {
          target: 'http://localhost:3000',
          changeOrigin: true,
        },
      },
    },
    define: {
      'import.meta.env.VSCODE': JSON.stringify(isVSCode ? 'true' : 'false'),
    },
  };
});
