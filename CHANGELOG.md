# Changelog

> Notable changes to 岚 (Ran) — Komari probe theme.

## v1.0.5 — 2026-04

字体大小后台开关 + 访客信息浮卡(带焦点地图)+ 流量单位策略 + 几个小修。

- **字体大小三档** — 后台 `[ SIZE ] 字体大小` 选 standard / large / xlarge,所有用户内容字(数字、表格、节点名、网速、延迟、单位、提示)按 1 / 1.18 / 1.36 缩放;装饰字(Etch 角标、版本号、Sidebar 导航、Topbar 按钮、节点小徽章)保持不变,布局尺寸不变,避免"字大撑爆卡片"
- **访客信息浮卡** — 首页右下角 IP / 地理 / 运营商 / 链路状态卡。设计走岚的精密金工质感(precision-card 多层 inset shadow + 凹陷读数窗 + SerialPlate + 4 角 crosshair),入场带"仪器启动"扫描线特效。每会话只弹一次,切到其它页面立即关闭。后台 `[ HUD ] 访客信息浮卡` 可关
- **访客焦点地图** — 浮卡内嵌迷你世界地图,显示访客位置(超大 glow 光晕 + 双相位脉冲 + 全屏十字辅助)。通过 iframe 复用 `map.html`,`index.html` 体积零增量
- **流量单位策略** — 后台 `[ NET ] 流量单位策略` 选 auto / min-kb / lock-kb,解决密集 NodeTable 里 B/KB/MB 单位频繁跳动的视觉噪音
- **/admin 入口** — Sidebar 底部加 Komari 后台登录铭牌按钮(SerialPlate 同款蚀刻工艺,顶部高光 + 底部凹陷 + hover 点亮 accent)
- **取消日元启发式** — 之前 ¥ 标价 > 100 自动当 JPY 处理,误判很多 CNY 节点;现在 ¥ / ￥ 一律 CNY,Billing 货币选项移除 JPY,真要标日元请直接配 'JPY' 等明确符号
- **MapApp embed 模式扩展** — 新增 `?embed=visitor&lat=&lon=` 子模式,纯静态轻量地图 + 单焦点高亮,不调 useKomari 不画节点,专门给 VisitorAlert iframe 用

## v1.0.4 — reserved

未单独发布,版本号留作 patch buffer。

## v1.0.3 — reserved

未单独发布,版本号留作 patch buffer。

## v1.0.2 — 2026-04

移动端 Node Detail 页面优化。

- **Specs strip** — 移动端从 6 列横排改 2 列网格,长字段(如 CPU 型号、OS 全名)允许换行,不再被省略号截断
- **Live metrics** — 移动端从 5 个 RadialGauge 改为 2x2+1 大数字卡片(LOAD AVG 跨两列居中),`Numeric` 32px mono 字号,底部 2px 进度条作为刻度隐喻;桌面端仍保留 RadialGauge

## v1.0.1 — 2026-04

Hub 卡片小修。

- **Hub Geographic Position** — 之前是个跳转占位,现在通过 iframe 嵌入 `./map.html?embed=1` 显示真地图预览,整块卡片可点跳转完整地图页。`index.html` 体积零增长(地图代码仍只在 `map.html` 内)
- **MapApp** — 新增 `embed` 模式:URL 带 `?embed=1` 时只渲染 `WorldMapPro`,无 chrome、无 padding;监听父页 `storage` 事件实现主题跨 iframe 同步

## v1.0.0 — 2026-04

正式版。功能完整、数据接入完整、双主题、双 entry、移动端就绪、生产部署验证(obsr.net 17 节点稳定运行)。

### 1.0 准备工作
- **Mobile/Responsive 适配**(从 v0.9.13 累积) — sidebar 抽屉化(< 768px)、Topbar 紧凑模式 + 汉堡、HeroStats 自适应列数(4→2x2→单列侧边布局)、Hub command bar wrap + TelemetryBar 4×2、Top Talkers 表格 → 2 行卡片、NodeTable grid floor 自适应、Billing 2 列 grid 折单列、Geo Map 移动端 placeholder、main padding + iOS `safe-area-inset-*` 全方位
- **死路由清理** — 移除 `alerts` / `settings` / `ping` 三个未实现的 Route(Active Alerts 仍作为 Overview/Hub 内的 *卡片功能* 保留)
- **Sparkline `responsive` prop** — 默认仍是固定像素宽,`responsive=true` 时改为 viewBox + width 100%(支持 HeroStats 移动端侧边布局)
- 文档更新:README 加 1.0 徽章、Mobile 段、响应式技术栈说明、CHANGELOG

### 1.0 涵盖的产品能力
- 7 个页面:Overview / Nodes / Node Detail / Hub / Traffic / Billing / Geo Map
- 完整数据接入:Komari REST + WebSocket(1s 轮询请求-响应)+ ping/load 历史
- 双主题:墨石(深色) / 雾色(浅色,默认)+ `prefers-reduced-motion`
- 双 entry build:`index.html`(主面板)+ `map.html`(独立地图页,d3-geo + natural-earth + 80+ 城市坐标)
- 多币种 Billing(USD/CNY/EUR/JPY/GBP/原始)+ open.er-api.com 汇率(5s 超时 + offline fallback)
- ErrorBoundary + null-guard 防御一个坏 payload 拖死全页
- 真站点验证:[obsr.net](https://obsr.net)

---

## 0.9 系列 — 移动端 + 地图

| 版本 | 主要内容 |
|---|---|
| **0.9.13** | 移动端响应式适配(7 commit + 1 fix);死路由清理;Sparkline 响应式 prop |
| 0.9.12 | Geo Map 独立页(`map.html`),双 entry build 切换 |
| 0.9.11 | 地图页骨架,所有路由打通 |
| 0.9.10 | Hub Geographic Position 卡内嵌世界地图预览 |
| 0.9.9 | Hub 时长选择器(1H/6H/24H/7D)+ chart overflow 修复 |
| 0.9.8 | Hub command bar 节点切换 dropdown(搜索 + 状态过滤) |
| 0.9.7 | Hub 单节点驾驶舱页(响应式 3/2/1 列) |

## 0.8 ↓ — 早期里程碑

| 版本 | 主要内容 |
|---|---|
| 0.6.0 | Traffic 页(Top Talkers + 区域分布) |
| 0.5.0 | Node Detail wires 真实 history + per-node ping |
| 0.4.0 | Nodes 列表 + 单节点详情 + hash 路由 |
| 0.3.0 | RowCard 视图 + 底部 rail(Alerts / Ping / Traffic) |
| 0.2.0 | Komari API live wiring |
| 0.1.0 | Vite + React + TS skeleton |

---

完整 commit 历史:`git log` 或 [GitHub](https://github.com/saladinxp/komari-ran-theme/commits/main)
