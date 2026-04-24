import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile'
import path from 'node:path'

// 岚 Komari Theme
// 双入口产物:
//   - dist/index.html — 主面板
//   - dist/map.html   — 独立地图页(华丽版,从 sidebar 跳过来)
// 因 vite-plugin-singlefile 强制 codeSplitting:false,与多 input 冲突,
// 所以构建分两次跑(`npm run build` 链式调用),通过 BUILD_TARGET 环境变量切换 entry。
// 每次 build 只处理一个 entry,产物互不覆盖(map.html 单独 build 时输出到 dist/ 与主 build 共存)。
const target = process.env.BUILD_TARGET || 'main'

const entryHtml = target === 'map' ? 'map.html' : 'index.html'

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
    // 不清空 dist —— 两次 build 互相保留产物
    emptyOutDir: target === 'main',
    rollupOptions: {
      input: {
        [target]: path.resolve(__dirname, entryHtml),
      },
      output: {
        inlineDynamicImports: true,
      },
    },
  },
})
