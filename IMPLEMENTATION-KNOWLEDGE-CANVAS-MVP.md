# Implementation Plan · Knowledge Canvas MVP (Phase UI-Prototype-1)

> **状态**：设计已批准，本文件为实现前技术方案（仅文档，无代码）。
> **前置设计文档**：`DESIGN-KNOWLEDGE-OS-UI.md` · `DESIGN-SYSTEM-AI-EMPLOYEE-OS.md` · `UI-PROTOTYPE-KNOWLEDGE-CANVAS.md`
> **硬约束**：不影响 `packages/llm/*`（LLM Router / Provider Manager / Agent Core）。不接真实 AI。
> **目标**：可运行的 PC Web 原型，mock 数据驱动，演示"AI 自动整理知识的大脑"。

---

## 1. 技术选型

| 关注点 | 选型 | 理由 |
|---|---|---|
| 构建 | **Vite 6**（仓库 pnpm store 已有 `vite@6.4.3` + `@vitejs/plugin-react@4.7.0`） | 零新外部依赖，dev server 秒级启动，支持 HMR |
| 框架 | **React 18.3**（store 已有 `react-dom@18.3.1`） | 与仓库 client 包一致，避免 19 差异 |
| 语言 | TypeScript 5.x | 类型先行，组件边界清晰 |
| 状态 | **轻量自研 store + `useSyncExternalStore`**（无 zustand 依赖） | 高频 pan/zoom 只改 world 层 transform，避免 context 全树重渲染；零新增依赖 |
| 画布 | **DOM world-layer（CSS transform）+ SVG overlay** | 与 m3e-canvas 同架构：`translate/scale` 作用在世界容器，节点为绝对定位 DOM，连线/AIConnection 用 SVG `<path>`。MVP 量级（<200 节点）性能足够，无需 canvas/Konva 引擎 |
| 样式 | 局部 CSS 变量（映射 `--dsw-alias-*` 语义），CSS Modules（`.module.css`） | 复刻设计系统，但原型 self-contained，不污染宿主 token |
| 动画 | **CSS transition/keyframes + Web Animations API**；弹簧用近似 cubic-bezier（或后续引入 `motion`） | 与 `DESIGN-SYSTEM` 动效 token 对齐；MVP 先用 CSS，避免引入重依赖 |
| 路由 | 单页 + 左侧导航切换"视图"（Knowledge / Memory / Import / Settings 仅 Knowledge 实装，其余占位） | MVP 聚焦 Canvas |

**明确不引入**：cordis 运行时、knowledge-remote、任何 `workspace:^` 依赖。原型是"孤岛 app"，仅供原型演示。

---

## 2. Package 位置

```
packages/apps/knowledge-canvas-ui/      ← 新建（独立 Vite app，非 cordis 插件）
├── package.json                        ← 仅声明 react / react-dom / vite / @vitejs/plugin-react / typescript（纯 semver，非 workspace:^）
├── vite.config.ts
├── tsconfig.json
├── index.html                         ← Vite 入口
├── public/mascots/                    ← 复制 assistant-dog-avatar.png / nox-cat-avatar.png（仅引用，不重绘）
└── src/
    ├── main.tsx
    ├── styles/tokens.css              ← 复刻 --dsw-alias-* 的局部变量
    ├── types.ts                       ← 领域模型 + KnowledgeBackend 接口（见 §7）
    ├── mock/                          ← mock 数据 + MockBackend 实现 + 模拟导入序列
    ├── store/                         ← canvas store（nodes/edges/view/selection）
    ├── canvas/                        ← Canvas 相关组件
    ├── shell/                         ← macOS Window Shell
    ├── nodes/                         ← KnowledgeNode 4 变体 + AgentAvatar + ThinkingRing + AIConnection
    └── panels/                        ← AI Insight Panel
```

**为何 `packages/apps/` 而非 `packages/client/`**：`packages/client/*` 是 cordis 插件，受 `dsh-client-bundle-purity` 纯净度门禁 + `tsdown.clientBundle` 约束，接入会牵连宿主构建与 lockfile。原型选 `packages/apps/` 作为独立 app，与 `llm/*`、client 插件、`ui-knowledge` 完全解耦。

### Lockfile 风险与处理（关键）
- 新包若被 `pnpm-workspace.yaml` 纳入，需在 CI `--frozen-lockfile` 前更新 lockfile（与既有 `ui-desktop` 的 lockfile 风险同源）。
- **MVP 策略**：本包 `package.json` 只引用 store 已存在的版本（react18 / vite6 / plugin-react4 / ts / types-react），本地用 `pnpm install`（非 frozen）一次即可；**lockfile 变更单独成 commit**（遵循既有纪律），不在本原型 commit 内混入。
- 演示期可直接用 store 内 vite 二进制 `node <store>/vite/bin/vite.js` 启动，绕开 lockfile 直至正式集成。

---

## 3. 组件树

```
<App>
├─ <MacWindowShell>                      // macOS 窗口壳
│  ├─ <TitleBar>                        // vibrancy 标题栏 + 红绿灯 + 标题「AI Employee OS · Knowledge」
│  ├─ <SideNav>                         // 左：员工入口 / Knowledge(实) / Memory(占位) / Import(占位) / Settings(占位)
│  │   └─ <AgentAvatarStack>            // 4 员工头像（2 真实 + 2 占位）
│  ├─ <CanvasRegion>                    // 中：无限画布
│  │   ├─ <CanvasViewport>              // 捕获 wheel/space-drag，写 view{x,y,z}
│  │   │   ├─ <WorldLayer>              // CSS transform: translate(x,y) scale(z)
│  │   │   │   ├─ <EdgeLayer> (SVG)     // 已建立关系 + AIConnection 虚线
│  │   │   │   └─ <KnowledgeNode> ×N    // 4 变体
│  │   │   │       ├─ <NodeIcon/>
│  │   │   │       ├─ <NodeTitle/>
│  │   │   │       ├─ <NodeMeta/>
│  │   │   │       └─ <AgentAvatar small/> // AI 状态归属
│  │   │   └─ <MarqueeSelect>          // 框选分组
│  │   └─ <CanvasToolbar>               // zoom +/-、fit、聚类、模拟导入
│  └─ <AIInsightPanel>                  // 右：可折叠
│      ├─ <ThinkingRing/>               // AI 工作中
│      ├─ <InsightSuggest/>             // 建议关联 / 聚类概览
│      └─ <ProviderStatusCard/>         // Ollama/Cloud 状态（mock）
└─ <MockImportSequencer>                // 驱动 "导入PDF→思考→生成→关联→聚类" 脚本
```

---

## 4. 状态管理方案

**原则**：pan/zoom 高频，绝不走 React context 全树重渲染。

- `store/canvasStore.ts`：纯 TS 单例，持有 `{ nodes, edges, view, selection, aiState }`，提供 `subscribe / getSnapshot / actions`。
- 视图变换（`view{x,y,z}`）存于 store 但由 `CanvasViewport` 用 **rAF + 命令式 `el.style.transform`** 直接写 world 层，订阅者只在该层；节点组件不因此重渲染。
- 节点拖拽：仅更新被拖节点 + 其相连 edge 的局部 state（store 选择性通知）。
- 选择/分组：selection set 变更触发相关节点重渲染（用 `useSyncExternalStore` 选择性订阅 id）。
- `aiState`：`idle | inferring | arrived | clustering`，驱动 ThinkingRing / AIConnection / 聚类动画。

> 备选：若后续需要跨组件复杂派生，可换 zustand（约 1KB），但 MVP 自研 store 零依赖足够。

---

## 5. Canvas 方案（对齐 m3e-canvas 范式）

| 能力 | 实现 |
|---|---|
| 相机 `View{x,y,z}` | world 层 `transform: translate(${x}px,${y}px) scale(${z})`；wheel 平移、⌘/Ctrl+wheel 缩放、空格+拖拽平移、触摸捏合 |
| Node drag | pointerdown→move→up，坐标经 `screenToWorld` 反算；拖拽中只动该节点 |
| Select | 点击选中（高亮描边）；框选生成 group |
| Group | 显式"成组"动作或框选 → 生成 `group` 容器，组内节点随容器移动 |
| Snap | 拖拽释放时计算与最近 cluster 中心距离 < 阈值则吸附（对齐参考线 SVG 显示，同 m3e `snapEdges`） |
| Edge connect | 拖拽节点"连接点"到目标 → 建立 `edge`；AI 自动关联用脚本生成 |
| 自动聚类 | 规则化 tidy：近邻同类 `joinRuns` 合并、`clusters` 重叠并集、锚定 hub 不动（移植 m3e `lib/tidy.ts` 思想，改为知识语义：按 source 类型/embedding 余弦近邻） |
| 性能 | world 层 transform 命令式写入；SVG edge 加 `will-change`；MVP 上限 ~200 节点 / ~400 连线 |

**复用而非复制**：m3e 的 `tidy.ts` 聚类思想（proximity + family + anchored hub）重述为 `store/clustering.ts`，不拷贝其源码，不修改 m3e 仓库。

---

## 6. 性能风险

| 风险 | 等级 | 缓解 |
|---|---|---|
| pan/zoom 全树重渲染 | 高 | world 层 transform 命令式写，节点不订阅 view |
| 大量 SVG edge 卡顿 | 中 | 上限封顶；`<path>` `will-change: transform`；静止态降级为简化描边 |
| 拖拽抖动 | 中 | pointer capture + rAF 批处理；只更新局部 |
| 头像 base64 体积 | 低 | 仅 2 张真实头像（assistant/nox），占位用 CSS |
| 聚类重算卡顿 | 低 | 仅在"成组/导入完成"触发，不入主渲染循环 |
| `prefers-reduced-motion` | — | 所有动画提供静态降级（设计系统已定） |

---

## 7. 后续接入 Agent / Memory / Embedding 的接口预留

**核心解耦：UI 只依赖接口，不依赖实现。** 定义 `src/types.ts` + `src/backend/KnowledgeBackend.ts`：

```ts
// 领域模型（与未来 cordis knowledge-remote 形状对齐，便于无 UI 改动切换）
export type NodeKind = 'document' | 'video' | 'conversation' | 'project'
export interface KnowledgeNode {
  id: string; kind: NodeKind; title: string
  meta: Record<string, string>          // 页数/时长/消息数/分支等
  source?: SourceRef                    // 来源（PDF/URL/视频/GitHub/Chat）
  aiStatus?: 'draft' | 'confirmed' | 'auto'  // 可解释/可撤销/可观察
  position: { x: number; y: number }
  groupId?: string
}
export interface KnowledgeEdge {
  id: string; from: string; to: string
  kind: 'manual' | 'ai-auto'           // ai-auto 必须可解释+可撤销
  reason?: string                      // 召回/关联原因（Explorer 复用）
}
export interface SourceRef { type: 'pdf'|'url'|'video'|'github'|'chat'; uri: string }

// 后端接口：Mock 现在实现，未来由真实 cordis remote 实现
export interface KnowledgeBackend {
  listNodes(): Promise<KnowledgeNode[]>
  listEdges(): Promise<KnowledgeEdge[]>
  importSource(src: SourceRef): Promise<{ nodeId: string }>   // 后续→分析→Embedding→关系
  getNeighbors(nodeId: string, text: string): Promise<{ nodeId: string; score: number; reason: string }[]>
  getMemory(): Promise<MemoryEntry[]>                          // AI Employee Memory 页
}
```

- `MockBackend` 现用内存 + 定时器脚本模拟"导入→思考→节点→关联→聚类"。
- 未来：`ui-knowledge` 插件内以 cordis `remote.knowledge` / `remote.memory` / embedding service / `ctx.llmRouter` 实现同一接口，组件层零改动。
- **Agent 接线无关**：本原型不触碰 `agent-loop`；未来 Router 调用在 `MockBackend`→`RealBackend` 替换时发生，UI 不变。

---

## 8. AI Animation Demo（mock 脚本）

按钮「模拟导入 PDF」触发 `MockImportSequencer`：

```
1) 用户点"导入 PDF"
2) AIInsightPanel 显示 ThinkingRing 旋转（aiState=inferring），文案"AI 正在理解文档…"
3) 2s 后：WorldLayer 在空位 spawn 一个 DocumentNode（reveal 缓动：scale .8→1 + opacity 0→1）
4) AIConnection 从相邻相关节点画出虚线 reveal（dashoffset 动画），reason="共享术语 X"
5) 触发自动聚类：相关节点 proximity 吸附 + 形成 group 轮廓
6) aiState=arrived → InsightPanel 给出"已加入知识地图，可撤销"；节点 aiStatus='auto'
```

全部为 **可解释（显示 reason）/ 可撤销（一键移除本次生成）/ 可观察（ThinkingRing + InsightPanel）**，符合设计评审三条铁律。

---

## 9. Mascot 资产策略（IP 合规）

| 员工 | MascotId | 资产现状 | 原型处理 |
|---|---|---|---|
| 中华田园犬 Assistant | `assistant` | ✅ `assistant-dog-avatar.png` | 复制至 `public/mascots/`，`<img>` 引用 |
| 黑猫 Research Agent (Nox) | `nox` | ✅ `nox-cat-avatar.png` | 同上 |
| 布偶猫 Knowledge Manager | — | ❌ 无 master 资产 | **占位**：蓝圈 + 猫形剪影/缩写「KM」，备注"待 master 确认后接入" |
| 边牧 Task Agent | — | ❌ 无 master 资产 | **占位**：黑白圈 + 狗形剪影/缩写「TA」，同上 |

> 严守 Mascot 视觉系统 v1.0：新角色必须同源视觉家族、master 确认后再扩展；**禁止 ImageGen 重绘**。占位仅为原型演示，不视为最终 IP。

---

## 10. 范围（MVP IN / OUT）

**IN**
- macOS Window Shell（标题栏 / 左导航 / 画布 / 右 Insight Panel，可折叠）
- 无限画布：zoom / pan / node drag / select / group / edge connect / snap / 自动聚类
- 4 类 KnowledgeNode（文档/视频/对话/项目）
- ThinkingRing + AIConnection reveal + 模拟导入序列
- 4 员工头像（2 真实 + 2 占位）
- mock 数据 + MockBackend

**OUT（后续阶段）**
- 真实 Embedding / 真实 Agent / Router 调用
- Embedding Explorer 页、Import 页管线、Memory 页（导航占位）
- 持久化、撤销/重做体系化、协同
- cordis 集成、测试套件（原型期可加少量 smoke，非强制）
- 真实 ProviderStatus 接入（现为 mock 卡片）

---

## 11. 实施步骤（确认后执行）

1. 建 `packages/apps/knowledge-canvas-ui/`，写 `package.json` / `vite.config.ts` / `tsconfig.json` / `index.html`。
2. `styles/tokens.css` 复刻设计系统变量；`shell/` 实现 macOS 窗口壳。
3. `types.ts` + `store/` + `canvas/`（Viewport / WorldLayer / EdgeLayer / 聚类）。
4. `nodes/`：KnowledgeNode 4 变体 + AgentAvatar + ThinkingRing + AIConnection。
5. `panels/AIInsightPanel` + `mock/` 数据 + `MockImportSequencer`。
6. 本地 `vite` 启动自检；动画脚本联调。
7. **不 commit**，输出：文件清单 / 启动方式 / 演示说明 / git 状态（确认仅新增本包）。

---

**待评审点**
- A. 包位置选 `packages/apps/knowledge-canvas-ui/`（vs `packages/ui/knowledge-canvas/`）——推荐前者（独立 app，避 purity 门禁）。
- B. 状态用自研 store（零依赖）vs zustand——推荐自研。
- C. 画布用 DOM+SVG（vs canvas/Konva）——推荐 DOM+SVG（同 m3e，MVP 够用）。
- D. 2 员工占位（无 master 资产）——是否接受，或先用纯色图标代。

确认后进入实现，仍不 commit。
