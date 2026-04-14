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

## 安装

前往 [Releases](https://github.com/saladinxp/komari-ran-theme/releases) 下载最新 zip,在 Komari 后台 → 主题设置 → 上传 zip 应用即可。

## 数据接入

主题部署后默认连同源的 Komari API:

- `GET /api/nodes` — 节点列表
- `GET /api/public` — 站点配置(站点名、retention 等)
- `WebSocket /api/clients` — 实时数据,自动重连,指数退避

API 不可达时(如本地 `npm run dev` 单独跑),会自动切到 mock 数据预览。

## 开发

```bash
npm install
npm run dev          # Vite HMR
npm run build        # 生成 dist/index.html(单文件,所有 JS/CSS 内联)
```

开发时可设置 `VITE_KOMARI_BASE` 指向已部署的 Komari 实例:

```bash
VITE_KOMARI_BASE=https://your-komari.com npm run dev
```

发版打包(给 Komari 用的 zip):

```bash
npm run build
zip -rq komari-ran-vX.Y.Z.zip komari-theme.json preview.png dist/
```

## 目录结构

```
src/
├── styles/tokens.css           设计令牌 + 双主题色板 + 动画
├── types/komari.ts             Komari API 类型(嵌套原始 + 扁平规范化)
├── api/
│   ├── client.ts               REST + WebSocket 客户端,自动重连
│   └── normalize.ts            原始 → 内部统一结构
├── hooks/
│   └── useKomari.ts            数据流 hook
├── utils/                      format / series
├── data/mock.ts                开发期 mock(API 不可达时显示)
├── components/
│   ├── atoms/                  Etch / Numeric / StatusDot / SerialPlate / ProgressBar / Donut
│   ├── charts/                 Sparkline / Heartbeat
│   ├── cards/                  NodeCardCompact
│   └── panels/                 Topbar
├── pages/Overview.tsx
├── App.tsx
└── main.tsx
```

## 技术栈

- **Vite** — 构建
- **React 19 + TypeScript** — 组件
- **vite-plugin-singlefile** — 内联打包

## 许可

MIT

## 作者

[Miuler](https://github.com/saladinxp) · [obsr.net](https://obsr.net)
