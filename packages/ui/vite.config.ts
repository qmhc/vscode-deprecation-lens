import { resolve } from 'path'

import solidPlugin from 'vite-plugin-solid'
import { viteStaticCopy } from 'vite-plugin-static-copy'
import { defineConfig } from 'vite'

/**
 * Vite 配置
 * - Solid.js 支持
 * - 复制 codicon 字体到输出目录
 * - 输出到 dist/webview
 */
export default defineConfig({
  plugins: [
    solidPlugin(),
    viteStaticCopy({
      targets: [
        {
          src: '../../node_modules/@vscode/codicons/dist/codicon.ttf',
          dest: '.',
        },
      ],
    }),
  ],
  build: {
    outDir: '../../dist/webview',
    emptyOutDir: true,
    rollupOptions: {
      input: resolve(__dirname, 'index.html'),
      output: {
        entryFileNames: 'index.js',
        chunkFileNames: '[name].js',
        assetFileNames: '[name].[ext]',
      },
    },
  },
})
