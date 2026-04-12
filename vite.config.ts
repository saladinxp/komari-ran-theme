import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile'
import path from 'node:path'

// 岚 Komari Theme
// 构建产物为单文件 dist/index.html (内联所有 JS/CSS),供 Komari 主题加载
export default defineConfig({
  plugins: [react(), viteSingleFile()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    target: 'es2020',
    cssCodeSplit: false,
    assetsInlineLimit: 100_000_000,
    chunkSizeWarningLimit: 4_000,
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
      },
    },
  },
})
