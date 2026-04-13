# 岚 (Ran) · Komari Probe Theme

> 精密金工质感的 Komari 探针面板主题

![preview](./preview.png)

## 设计理念

灵感来自 Astell&Kern 等精密 HiFi 器材的 CNC 数控加工外观:阶梯倒角、蚀刻铭牌、凹陷显示窗、真 1px 发丝线。**每一根边线都有理由**。

- **双 hairline 倒角** — 外亮内暗,模拟金属倒角
- **凹陷读数窗(precision-inset)** — 数据展示区下沉,有阴影
- **蚀刻铭牌字(Etch)** — 9px 等宽 uppercase wide-tracking
- **接缝装饰(seam)** — 模拟硬件拼接缝
- **GPU 友好的微动效** — 状态点呼吸、scan 等轻量动画,无重资源消耗
- **`prefers-reduced-motion`** — 尊重无障碍设置

## 主题变体

| | 名称 | 用途 |
|---|---|---|
| 🌑 | **墨石 ran-night** | 深色,默认 |
| 🌫️ | **雾色 ran-mist** | 暖奶油浅色 |

切换可在右上角 NIGHT/MIST 按钮,或由 Komari 主题设置默认值。

## 目录结构

```
src/
├── styles/tokens.css           设计令牌 + 双主题色板 + 动画
├── types/komari.ts             Komari API 类型(嵌套原始 + 扁平规范化)
├── api/
│   ├── client.ts               REST + WebSocket 客户端,自动重连
│   └── normalize.ts            原始 → 内部统一结构
├── hooks/
│   └── useKomari.ts            数据流 hook,接 /api/nodes + WS /api/clients
├── utils/
│   ├── format.ts               字节/百分比/parseLabels/daysUntil
│   └── series.ts               数据生成
├── data/mock.ts                开发期 mock 数据(API 不可达时显示)
├── components/
│   ├── atoms/                  Etch / Numeric / StatusDot / SerialPlate / ProgressBar / Donut
│   ├── charts/                 Sparkline / Heartbeat
│   ├── cards/                  NodeCardCompact (RowCard / DetailCard 后续)
│   └── panels/                 Topbar
├── pages/
│   └── Overview.tsx            概览页
├── App.tsx                     主应用,主题持久化,API/mock 兜底
└── main.tsx                    入口
```

## 数据接入

主题部署后默认连同源的 Komari API:

- `GET /api/nodes` — 节点列表
- `GET /api/public` — 站点配置(站点名、retention 等)
- `WebSocket /api/clients` — 实时数据,自动重连,指数退避

如果 API 不可达(如本地 `npm run dev` 单独跑),会自动切到 mock 数据预览。

开发时可设置 `VITE_KOMARI_BASE` 环境变量指向已部署的 Komari 实例:

```bash
VITE_KOMARI_BASE=https://your-komari.com npm run dev
```

## 开发

```bash
# 安装依赖
npm install

# 开发模式(Vite HMR)
npm run dev

# 构建单文件 dist/index.html(给 Komari)
npm run build
```

构建产物 `dist/index.html` 是单文件,所有 JS / CSS 已内联(由 `vite-plugin-singlefile` 处理),可直接上传至 Komari 后台主题目录。

## 安装到 Komari 面板

1. `npm run build` 生成 `dist/index.html`
2. 将仓库根的 `komari-theme.json`、`preview.png` 与 `dist/` 目录一同打包为 zip
3. 在 Komari 后台 → 主题设置 → 上传 zip 应用

## 技术栈

- **Vite** — 构建
- **React 19 + TypeScript** — 组件
- **vite-plugin-singlefile** — 内联打包

## 许可

MIT

## 作者

[Miuler](https://github.com/saladinxp) · [lol.moe](https://lol.moe)
