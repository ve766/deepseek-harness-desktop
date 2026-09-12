# DESIGN · AI Employee OS — Knowledge OS UI

> 阶段：设计（纯方案，无代码）。
> 目标产品：AI Employee OS Desktop PC 客户端。
> 风格基线：Apple macOS（vibrancy / 大圆角卡片 / 克制阴影 / 系统字体 / 弹簧动效），面向**普通用户**，不做开发者工具感。
> 交互思想来源：**仅研究 m3e-canvas 的交互机制**（Next.js 16 + React 19 + `motion` + Tailwind 的浏览器画布编辑器），不改其源码、不取其实现，只借鉴其交互范式后重新落地到知识场景。

---

## 0. 设计原则 & m3e-canvas 借鉴映射

四条产品原则：

1. **空间即理解** —— 知识不是列表，而是可漫步的"地图"。参考 m3e-canvas 的无限画布（pan/zoom/拖拽），让用户在二维空间里"看见"知识结构。
2. **让 AI 的动作可见、可解释** —— 参考 m3e-canvas 的 `ThinkingRing`（模型工作时节点外圈转环）+ `revealing`（到达时颜色缓动）机制，把"AI 自动关联"做成**可观察的、可被信任的**发现过程，而非黑箱。
3. **手感优先** —— 所有位移用 `motion/react` 弹簧物理（m3e-canvas 的 `CARRY`/`OPEN`/`SETTLE_MS` 思路），拖拽有重量感、归位有吸附。
4. **普通用户语言** —— 不用"向量""余弦相似度""embedding 维度"等词作为主文案；技术术语只在"解释"面板里以**白话**出现。

| m3e-canvas 交互机制 | 在 Knowledge OS 的落地 |
|---|---|
| 无限画布 `View{x,y,z}`：滚轮平移、`ctrl/⌘+滚轮`缩放、空格+拖拽平移、双指捏合 | **Knowledge Space** 画布，同样的三态相机 |
| 从面板拖入画布（`fromPalette`） | **Knowledge Import** 拖入文件；Knowledge Space 拖入新节点 |
| 磁吸聚类 `findSnap`（同类相邻融合，吸附力 0→1 渐强）+ 对齐参考线 `findGuide`（边/中心吸合画线） | 节点靠近时**自动吸附成簇**；拉对齐时显示参考线 |
| 自由分组 `free` + 帧容器 `Frame` | 手动聚簇；**项目节点**作为"容器帧"圈住一组相关节点 |
| AI「生成设计」`ThinkingRing` + `revealing` 缓动到达 | **AI 自动关联**：推断关系时节点外圈转环，新连线缓动浮现 |
| `tidyFrame` 规则化自动布局（`joinRuns` 近邻同类合并、`clusters` 重叠并集、`snapEdges` 容差内对齐、锚定元素固定） | **聚类展示**：「自动整理」按相似度/近邻重排，hub 节点锚定不动 |
| 左侧标签栏（parts/layers/colors/…）+ 右侧 Inspector | 左侧**过滤器/图层面板** + 右侧**节点检查器** |
| 快照历史（同字段 800ms 内合并为一步撤销） | 全局撤销/重做，关系编辑合并 |
| 扁平可序列化 `Doc`（groups/frames/items） | 知识图谱扁平 JSON：`nodes`/`edges`（见 §3.2） |
| 响应式底部表单（mobile bottom sheet） | Desktop 为主，弹层用 macOS sheet |

---

## 1. 页面结构（Page Structure）

整体壳（macOS 窗口隐喻，非浏览器标签）：

```
┌──────────────────────────────────────────────────────────┐
│  Title Bar（透明 vibrancy，无红绿灯，仅居中标题 + 全局搜索） │
├──────────┬───────────────────────────────────────────────┤
│ Sidebar  │  Content（四个页面之一，整页切换，非 tab 堆叠）  │
│ (icon    │                                               │
│  rail +  │   Knowledge Space │ Embedding Explorer │       │
│  mini    │   Knowledge Import │ AI Employee Memory        │
│  list)   │                                               │
│          │                                               │
├──────────┴───────────────────────────────────────────────┤
│  Status Bar（轻量：节点数 / 向量模型 / 最后同步时间）       │
└──────────────────────────────────────────────────────────┘
```

四个页面（点击侧栏图标整页切换，带 200ms 弹簧过渡）：

| 页面 | 一句话定位 | 主视觉 |
|---|---|---|
| **Knowledge Space** | 知识的"地图"，可漫步、可聚类 | 无限画布 + 节点 + AI 关联连线 |
| **Embedding Explorer** | "为什么召回这条？"的可解释性玩具 | 输入框 + 相似结果列表 + 原因解释 |
| **Knowledge Import** | 把外部资料"喂"进来 | 四步管道可视化（导入→分析→Embedding→建关系） |
| **AI Employee Memory** | AI 学到了什么，用户可审阅/纠正 | 四栏知识卡片（用户/项目/习惯/任务） |

---

## 2. 信息架构（Information Architecture）

**心智模型**：AI Employee OS 是一个"有记忆的同事"。Knowledge OS 是这位同事的"笔记本 + 书架 + 经验库"。

```
AI Employee OS
└── Knowledge OS
    ├── 知识地图 (Knowledge Space)      ← 主入口，探索与发现
    ├── 理解引擎 (Embedding Explorer)   ← 追问"为什么",调试/教学
    ├── 知识摄入 (Knowledge Import)     ← 输入,管道化
    └── 记忆面板 (AI Employee Memory)   ← 审阅与纠偏,信任建立
```

导航规则：
- **Space 是中心**，其余三页为"从 Space 发起的动作"：选中节点 → 右键/按钮可「在 Explorer 中查看相似」；拖入文件 → 跳 Import；「查看 AI 记忆」→ Memory。
- **单向深入、随时返回**：Import 完成后落回 Space 并高亮新节点；Explorer 从 Space 的节点进入。
- **全局统一对象模型**：四个页面共享同一套 `Node` / `Edge` / `Source` 类型，避免"各页各一套"。

---

## 3. UI 组件设计（UI Component Design）

### 3.1 通用壳组件（macOS 质感）

- **VibrantWindow**：标题栏与侧栏用 `backdrop-filter: blur` 半透明；内容区为不透明 `surface`。
- **IconRail**：左侧 64px 图标栏（SVG 线性图标，24px，选中态用 `secondaryContainer` 圆角底）。
- **Sheet / Modal**：居中卡片 + 遮罩，出现用 `scale 0.96→1` + 透明度弹簧。
- **SegmentedControl**：用于页面内子视图切换（如 Memory 的四栏切换）。
- **Card**：圆角 14px、1px `outlineVariant` 描边或 1–2 级阴影、`padding: 16–20px`、悬停轻微上浮（`translateY(-2px)` + 阴影加深）。
- **Toast / StatusBar**：非阻塞、自动消散。

### 3.2 Knowledge Space（知识地图）

**画布节点类型**（每种一个柔和色彩家族，区别于"开发者工具"的灰蓝）：

| 节点类型 | 图标隐喻 | 颜色家族 | 内容 |
|---|---|---|---|
| 文档 Document | 纸张 | 蓝 | 标题 + 来源 + 片段数 |
| 视频 Video | 播放 | 紫 | 标题 + 时长 + 章节数 |
| 对话 Conversation | 气泡 | 绿 | 对方名 + 轮次数 |
| 项目 Project | 文件夹帧 | 橙（容器） | 圈住一组相关节点 |
| AI 推断关系边 Edge | —— | 中性灰/虚线 | 两节点间连线，hover 显示"为什么相关" |

**节点卡片（参考 m3e-canvas 的 `M3Node` 卡片渲染）**：
- 固定尺寸卡片（如 200×auto），图标 + 标题（单行省略）+ 一行副信息；
- 选中：`outline: 2px solid primary`，`outline-offset: 3px`（与 m3e-canvas 一致的 3px 外描边）；
- 拖拽中：`scale 0.97` + 光标 `grabbing`；
- 落入簇时：被吸附目标显示**磁吸高亮**（参考 `findSnap` 的 `pull` 渐强）。

**连线（Edge）**：
- 默认细线 `1px` `outlineVariant`；
- **AI 自动关联**新边：虚线 + 缓动从 `opacity 0 → 1`、长度从 0 生长（参考 `revealing` 的 900ms 缓动）；
- hover 边：显示气泡「这两条因为：都提到 XX / 同属项目 Y / 语义相似度 0.8x（示意）」。

**侧栏（左）**：
- 顶部：搜索 + 过滤 chip（类型 / 最近 / 未归类）；
- 中部：缩放控制（− 适配 ＋）、「自动整理」按钮（触发 tidy 聚类）；
- 底部：图例（节点颜色含义）。

**检查器（右，参考 Inspector）**：选中节点显示 —— 标题、来源链接、类型、关联节点数、标签；可改名、加标签、删除、或「在 Explorer 中查看相似」。

### 3.3 Embedding Explorer（理解引擎）

布局：**左输入 / 右结果**，非画布。

- 顶部：模型选择（下拉，显示友好名如「通用语义模型」而非 `bge-m3`）、文本框（"输入一句话，看 AI 召回了什么"）。
- 主区：点击「查找相似」后，下方流式列出 **Top-K 相似知识卡片**，每张卡：
  - 节点缩略（图标 + 标题 + 来源）；
  - **召回原因解释条**（白话）：如「这段话和你在《XX 文档》里写的'部署流程'语义接近」「同属『项目 Alpha'」；
  - 一个**相似度示意条**（非精确数值，用 5 段强度条，避免吓到普通用户；高级用户可展开看分值）。
- 底部可折叠「技术细节」：embedding 维度、距离度量（默认收起，开发者/好奇用户才看）。

> 借鉴 m3e-canvas 的"普通人语言 + 可选高级"分层：主文案白话，细节可展开。

### 3.4 Knowledge Import（知识摄入）

**四步管道可视化**（横向 stepper，每步一个圆形节点 + 连线，完成时节点变实心绿）：

```
[1 导入] → [2 分析] → [3 嵌入] → [4 建立关系]
 选择源    解析结构   生成向量    推断关联
```

支持源（卡片网格，拖入或点击）：
- PDF / 网页 / 视频 / GitHub 项目 / Chat 记录。

每步状态：
- **导入**：拖放区（大虚线框，hover 高亮；参考 m3e-canvas 的拖入落点高亮）；显示文件名/URL 输入。
- **分析**：转圈（用 m3e-canvas `ThinkingRing` 同款 conic-gradient 旋转环，但改为居中卡片而非节点外圈）；展示"识别到 N 个段落 / N 个章节"。
- **嵌入**：进度条（语义化文案"正在把文字变成 AI 能懂的表示"）。
- **建立关系**：展示"发现 M 条与已有知识的关联"，可预览（不强制接受）。

完成后：「加入知识地图」按钮 → 跳 Space 并**高亮/缓动浮现**新节点（参考 `arrive()` 的 reveal 缓动）。

### 3.5 AI Employee Memory（记忆面板）

四栏 **SegmentedControl** 切换，每栏是卡片流：

| 栏 | 内容 | 用户可操作 |
|---|---|---|
| 用户知识 | "你常用 qwen3:8b""你偏好稳定优先" | 赞同 / 纠正 / 隐藏 |
| 项目知识 | "项目 Alpha 用 pnpm""Phase B Router 已验收" | 查看来源 / 补充 |
| 工作习惯 | "你常在晚上做打包""提交前必跑 forbidden-file check" | 确认 / 忽略 |
| 历史任务 | "上次导入了 3 份 PDF""上周修了 Router failover bug" | 展开详情 / 定位到 Space 节点 |

每条记忆卡右下角有「来源」小字（"来自 Chat 记录 / 来自文档 XX / AI 推断"），建立**可审计的信任**。纠正动作走快照历史（可撤销）。

---

## 4. 交互流程（Interaction Flow）

### 4.1 Knowledge Space 漫步与聚类
1. 打开 Space：相机 `fit` 到全部节点（参考 m3e-canvas `fit()` 的留白与缩放钳制）。
2. 滚轮平移、`⌘+滚轮`缩放、空格+拖拽平移；触摸板双指捏合。
3. 拖动节点：靠近同类/同项目节点时**磁吸高亮**，松手吸附成簇（参考 `findSnap` 的 `pull` 渐强 + 落定 `SETTLE_MS` 缓动）。
4. 拉对齐时显示参考线（参考 `findGuide`）。
5. 点「自动整理」：触发 tidy 聚类 —— 近邻同类合并、重叠并集、hub（项目节点）锚定不动、其余按相似度流排（参考 `joinRuns`/`clusters`/`tidyFrame` 规则）。

### 4.2 AI 自动关联（核心差异化）
1. 用户点「让 AI 发现关联」或导入完成后。
2. 相关节点外圈出现 `ThinkingRing` 转环（AI 推断中）。
3. 推断完成：新 `Edge` 以**虚线 + 生长缓动**浮现（参考 `revealing`）。
4. hover 边即见白话原因；不满意的关联可删除（走撤销）。

### 4.3 Embedding Explorer 追问
1. Space 选中节点 → 「查看相似」→ 进入 Explorer，自动填入该节点文本。
2. 改模型 / 改输入 → 结果流式刷新。
3. 点结果卡 → 跳回 Space 并定位/高亮对应节点。

### 4.4 Knowledge Import 管道
拖入文件 → 四步 stepper 顺序推进（每步异步，可暂停在最末步预览关系）→ 「加入地图」→ 回 Space 高亮新节点。

### 4.5 Memory 审阅
打开 Memory → 四栏浏览 → 对单条记忆「纠正」→ 写入纠正并记快照 → 信任度提升。

---

## 5. 状态变化（State Changes）

| 状态 | 触发 | 视觉 |
|---|---|---|
| `idle` | 初始 | 静态画布 |
| `dragging` | 指针按下移动 >5px | 节点 `scale .97`、光标 grabbing、目标簇磁吸高亮 |
| `panning` | 空格/中键/空白拖拽 | 画布整体随相机移动（弹簧 `cameraEasing`） |
| `ai-inferring` | AI 关联中 | 相关节点 `ThinkingRing` 转环 + 轻微亮度提升 |
| `ai-arrived` | 推断完成 | 新边 `opacity 0→1` + 长度生长，`revealing` 900ms 缓动 |
| `clustering` | 自动整理中 | 节点向目标位弹簧位移（`SETTLE_MS` 缓动） |
| `importing` | 摄入管道 | stepper 当前步转环 + 进度；完成后 reveal |
| `error` | 摄入/嵌入失败 | 非阻塞 Toast + stepper 当前步红色描边，可重试 |
| `selected` | 点选节点 | `outline 2px primary offset 3px` + 右检查器展开 |

**动效统一参数**（取自 m3e-canvas 手感）：拖拽位移弹簧 `{stiffness:620, damping:38, mass:0.7}`；归位/吸附 `{stiffness:700, damping:42}`；尺寸/圆角缓动用 `cubic-bezier(0.2,0,0,1)` 约 200–300ms；reveal 约 900ms。

**可访问性**：尊重 `prefers-reduced-motion`（参考 m3e-canvas `useReducedMotion`）：转环与生长动画降级为淡入。

---

## 6. React 实现建议（React Implementation Notes）

> 本节为**架构与选型建议**，非实现代码。

- **栈**：React 19 + `motion`（原 Framer Motion，`motion/react`）+ TypeScript；样式用 Tailwind v4 或 CSS-in-JS 均可，关键在 `backdrop-filter` 实现 vibrancy。
- **画布相机**：复用 m3e-canvas 的 `View{x,y,z}` 模式 —— 一个外层 `transform: translate(x,y) scale(z)` 的容器，所有节点绝对定位在世界坐标；平移/缩放只改 `view` state（滚轮/捏合/空格拖拽），**不要**逐节点改坐标。
- **节点渲染**：每个节点一个 `motion.div`，`animate` 圆角/缩放；尺寸由内容测量（参考 m3e-canvas 的 `useLayoutEffect` 测量 + `widths` map）或固定卡片尺寸。
- **磁吸与对齐**：拖拽 move 时计算 `findSnap`（同类型/同项目近邻 → 吸附目标 + 渐强 `pull`）+ `findGuide`（边/中心参考线），松手 commit 到数据层。
- **自动聚类 tidy**：独立纯函数 `tidyLayout(nodes, edges)`：近邻同族合并、重叠并集、hub 锚定、其余流排、容差内对齐（≤6px 才动，绝不"替用户做主"）。与渲染解耦，便于单测。
- **AI 关联动画**：`ai-inferring` 时给相关节点挂 `ThinkingRing`（conic-gradient + `blur` + 旋转）；结果边用 `motion` 的 `pathLength` 从 0 生长 + 透明度缓动。
- **数据模型（扁平可序列化，参考 m3e-canvas `Doc`）**：
  - `Node { id, type, title, subtitle, sourceId?, clusterId?, x, y, createdAt }`
  - `Edge { id, from, to, kind:'auto'|'manual', reason, confidence? }`
  - `Source { id, kind:'pdf'|'web'|'video'|'github'|'chat', ref, importedAt }`
  - `GraphDoc { nodes, edges, sources, view }` —— 整图可 JSON 存取（local/云端）。
- **历史**：快照式 undo/redo（`past[]`/`future[]`，同字段 800ms 内合并），仅序列化 `GraphDoc`。
- **持久化**：首版可 `localStorage`/文件；接入现有 Knowledge API（`import`/`search`/`query`）做源与检索。
- **性能**：节点多时用 `transform` 而非 `left/top` 动画；离屏视口外的节点可虚拟化（参考 m3e-canvas 用 `view` 钳制视口）。

---

## 7. 后续插件化设计建议（Pluginization）

让 Knowledge OS 成为"可生长"的系统，而非写死四页。建议三层插件点：

1. **知识源插件（Source Plugin）**
   - 契约：`{ kind, label, icon, import(input) → Source + 原始块 }`。
   - 新增源（如 Notion / 本地文件夹 / 邮件）只需注册一个插件，Import 页卡片网格自动增加一项。
   - 与现有 `KnowledgeImport` remote API 对齐（markdown/text + 元信息）。

2. **嵌入/向量插件（Embedding Plugin）**
   - 契约：`{ id, friendlyName, dimensions, embed(text[]) → number[][] , similarity(a,b) }`。
   - Explorer 的模型下拉、Import 的「嵌入」步均从插件注册表读取；换模型不碰 UI。
   - 本地 Ollama `qwen3:8b` 等可作为一个"本地模型"插件，呼应你本地推理偏好。

3. **关系策略插件（Relationship Plugin）**
   - 契约：`{ id, describe(nodes, edges) → Edge[]（含 reason 白话） }`。
   - 「AI 自动关联」与「自动整理」都消费此插件；可插拔不同策略（语义相似 / 共现 / 项目归属 / 时间邻近）。
   - 每条 `Edge.reason` 由策略产出，保证 Explorer 的"为什么"始终有来源。

4. **记忆存储插件（Memory Store Plugin）**
   - 契约：`{ load(scope), save(item), correct(item, patch) }`。
   - Memory 页四栏由 `scope`（user/project/habit/task）驱动；纠正动作走插件 `correct`，天然可审计。

**插件注册方式**（不破坏现有架构）：沿用仓库现有 cordis 插件机制 —— 每个插件是一个 `apply(ctx, config)`，向 `ctx.knowledge` 服务注册上述契约；UI 通过 `ctx.knowledge.sources()` / `.embeddingModels()` / `.relationshipStrategies()` 读取，零硬编码。

**向后兼容**：内置源/模型/策略作为"默认插件"随包提供；用户/市场安装的插件追加到注册表，UI 自动展开。

---

## 附录 A · m3e-canvas 交互思想摘录（研究笔记，未改动其源码）

- 相机：`View{x,y,z}`，`MIN_Z=0.25, MAX_Z=3`；`setZoomAt` 以光标为锚缩放；`fit()` 计算包围盒 + 留白钳制。
- 拖入：`fromPalette` 标记；落点越界（屏幕外）则丢弃；落在帧内则继承帧宽。
- 磁吸：`findSnap` 仅同类 `canJoin` 可融合，`pull = (1-d)^PULL_EXP` 渐强；`findGuide` 取邻居与帧的边/中心，容差 `GUIDE_PX/z`。
- 分组：`free` 自由组（手动聚簇），`Frame` 容器（手机屏），`groupSelected`/`ungroupSelected` 合并拆分。
- AI：`draftDesign` 调模型 → `arrive()` 将画布整体替换并 `revealing` 900ms 颜色缓动；`ThinkingRing` 为 conic-gradient + blur 旋转环。
- Tidy：`joinRuns`（近邻同族合并）、`clusters`（重叠并集，大者命名容器）、`rowsOf`（同行成排）、`tidyFrame`（锚定栏/底栏不动，内容流排，容差内 `snapEdges`/`evenCorners`）。
- 历史：快照 `past/future`，同 key 800ms 合并一步。
- 模型：`Doc{groups, frames, ...}`，`Group{id,x,y,axis,items[],free?}`，`Item{id,kind,label,icon,...}`，`Frame{id,name,x,y}`——均 JSON 可序列化。
- 响应式：`<840px` 或粗指针且 `<1024px` 切换 phone 模式（单屏 + 底部表单）。

> 以上仅为交互范式参考；Knowledge OS 已按自身领域（知识/记忆/可解释性）重新诠释，未复制任何 m3e-canvas 具体组件或逻辑。
